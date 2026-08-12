import { GenerateTreeRequest, ExpandNodeRequest, LearningTree } from "../types";
import { MAX_NODE_EXPANSION_DEPTH } from "./constants";
import { FailureKind, classifyFailure, isSplittable, withBurstRetry } from "./llmResilience";
import { ModelCaller, expandNodeViaSplit, generateTreeViaSplit } from "./llmSplit";
import {
  assembleSubNodesFromParsedData,
  assembleTreeFromParsedData,
  buildExpandNodePrompt,
  buildFallbackTree,
  buildGenerateTreePrompt,
  normalizeExistingTitles,
  parseJsonFromModelText,
} from "./llmShared";

// The provider-agnostic escalation ladder, shared by geminiClient / openaiClient /
// anthropicClient. Each of those files now owns only its HTTP call; everything about how hard we
// try before giving up lives here, so all three behave identically.
//
// The ladder, in order:
//   1. One grounded single-shot call, with a short backoff retry for transient failures.
//   2. The same call with search grounding off - when the tool itself looks like the problem.
//      Skipped for a plain burst limit, where the same oversized request would fail again.
//   3. Rebuild from a small outline call plus spaced detail calls (llmSplit.ts) - for burst
//      limits and truncated responses, i.e. whenever "too much at once" is the real problem.
//   4. Only then fall back to canned content, tagged with the real reason.
//
// Steps 2 and 3 are the difference between "your quota is gone, here is filler" and actually
// getting the user's tree built. Each rung is cheap and bounded, because all of this happens
// while someone watches a spinner.

export interface RunResult {
  /** Set when canned fallback content was substituted for real model output. */
  isFallback?: boolean;
  fallbackReason?: FailureKind;
  /** Set when the result was assembled from several smaller calls rather than one. */
  isSplit?: boolean;
  /** Set when some of those smaller calls failed and their nodes have no items/resources yet. */
  isPartial?: boolean;
  /** Set when the result came back without web-search grounding, so resource links are weaker. */
  isUngrounded?: boolean;
  /**
   * The provider's own error text, trimmed. Shown to the user only for the generic buckets
   * (api_error / parse_error) where our own wording cannot say anything useful - on a phone there
   * is no console to read, so without this a real cause like "Search Grounding is not supported
   * for this model" is invisible.
   */
  fallbackDetail?: string;
}

/** A parse failure carries no HTTP status, so tag it explicitly for classifyFailure's callers. */
function parseFailureError(cause: unknown): Error & { kind: FailureKind } {
  const err = new Error(`Model response was not usable JSON: ${String((cause as any)?.message ?? cause)}`) as Error & {
    kind: FailureKind;
  };
  err.kind = 'parse_error';
  return err;
}

function detailOf(err: any): string | undefined {
  const detail = classifyFailure(err).detail;
  return detail && detail.trim() ? detail.trim() : undefined;
}

function kindOf(err: any): FailureKind {
  return err?.kind === 'parse_error' ? 'parse_error' : classifyFailure(err).kind;
}

/** Worth rebuilding as several smaller calls? Burst limits and truncated output, yes. Dead key, no. */
function worthSplitting(kind: FailureKind): boolean {
  return isSplittable(kind) || kind === 'parse_error';
}

/**
 * Worth retrying the same request with Google Search grounding turned off?
 *
 * Yes for everything except failures that are about the key itself. Grounding is an *enhancement*
 * - it makes resource links come from live search results instead of the model's own recall - so
 * dropping it is always preferable to returning nothing.
 *
 * This deliberately covers plain `api_error` and not just `grounding_limit`. Grounding is a
 * separately-provisioned feature: a free-tier key, a project without billing enabled, or a model
 * that doesn't offer the tool can reject the *tool* with a 400 whose text says nothing about
 * quotas or grounding at all. Classified narrowly, that fell through every recovery rung and
 * surfaced as "something went wrong contacting the AI" - even though the identical request
 * without the tool would have worked. One extra request is a cheap price for that.
 */
function worthUngroundedRetry(kind: FailureKind): boolean {
  // Failures about the key itself: a second call changes nothing.
  if (kind === 'auth_error' || kind === 'quota_exhausted' || kind === 'server_key_missing') return false;
  // A plain burst limit is about how much we asked for, not about the tool - the same oversized
  // request without grounding is just as likely to be refused, and each doomed attempt is another
  // wait the user sits through. Splitting is the right answer there, so go straight to it.
  if (kind === 'rate_limit') return false;
  return true;
}

// Attempts for the single big request. Deliberately low: when it fails there are better moves
// than asking again for exactly the same thing, and every extra attempt is a visible delay.
const SINGLE_SHOT_ATTEMPTS = 2;

export async function runGenerateTree(
  callModel: ModelCaller,
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree } & RunResult> {
  const { topic, language = "he", depthLevel = "comprehensive", customInstructions = "" } = request;
  const prompt = buildGenerateTreePrompt(topic, language, depthLevel as any, customInstructions);

  const singleShot = async (grounded: boolean): Promise<LearningTree> => {
    const text = await withBurstRetry(() => callModel(prompt, { grounded }), { attempts: SINGLE_SHOT_ATTEMPTS });
    let parsed: any;
    try {
      parsed = parseJsonFromModelText(text);
    } catch (parseErr) {
      throw parseFailureError(parseErr);
    }
    return assembleTreeFromParsedData(parsed, topic, language);
  };

  let lastErr: any;
  try {
    return { success: true, tree: await singleShot(true) };
  } catch (err: any) {
    if (err?.message === "API_KEY_MISSING") throw err;
    lastErr = err;
  }

  // Grounding is provisioned separately from the model and has its own, much smaller allowance, so
  // a grounded call can fail while the identical ungrounded call succeeds. Resource URLs then lean
  // on sanitizeResourceUrl's fallback links instead of live search results - a real tree with
  // weaker links, which beats no tree at all.
  if (worthUngroundedRetry(kindOf(lastErr))) {
    try {
      return { success: true, tree: await singleShot(false), isUngrounded: true };
    } catch (err: any) {
      if (err?.message === "API_KEY_MISSING") throw err;
      lastErr = err;
    }
  }

  if (worthSplitting(kindOf(lastErr))) {
    try {
      const failure = classifyFailure(lastErr);
      const { tree, partial } = await generateTreeViaSplit(callModel, topic, language, depthLevel as any, failure);
      return { success: true, tree, isSplit: true, isPartial: partial };
    } catch (err: any) {
      if (err?.message === "API_KEY_MISSING") throw err;
      lastErr = err;
    }
  }

  return {
    success: true,
    tree: buildFallbackTree(topic, language as any),
    isFallback: true,
    fallbackReason: kindOf(lastErr),
    fallbackDetail: detailOf(lastErr),
  };
}

export async function runExpandNode(
  callModel: ModelCaller,
  request: ExpandNodeRequest
): Promise<{ success: boolean; isEndOfTopic?: boolean; subNodes?: any[]; message?: string } & RunResult> {
  const {
    treeTopic,
    nodeId,
    nodeTitle,
    nodeDescription,
    nodeDepth = 0,
    ancestors = [],
    existingTitles,
    existingTreeContext = "",
    language = "he",
  } = request;
  const isHe = language === 'he';

  if (nodeDepth >= MAX_NODE_EXPANSION_DEPTH) {
    return {
      success: true,
      isEndOfTopic: true,
      subNodes: [],
      message: isHe ? "הענף הגיע לעומק מפורט מרבי" : "Branch reached maximum depth level",
    };
  }

  const existingTitlesList = normalizeExistingTitles(existingTitles, existingTreeContext);
  const ancestorChain = Array.isArray(ancestors) ? ancestors.filter(Boolean) : [];
  const prompt = buildExpandNodePrompt(
    treeTopic, nodeTitle, nodeDescription, nodeDepth, ancestorChain, existingTitlesList, language
  );

  const singleShot = async (grounded: boolean) => {
    const text = await withBurstRetry(() => callModel(prompt, { grounded }), { attempts: SINGLE_SHOT_ATTEMPTS });
    let parsed: any;
    try {
      parsed = parseJsonFromModelText(text);
    } catch (parseErr) {
      throw parseFailureError(parseErr);
    }
    return assembleSubNodesFromParsedData(parsed, nodeId, existingTitlesList, treeTopic, nodeTitle, language);
  };

  let lastErr: any;
  try {
    const result = await singleShot(true);
    return { success: true, isEndOfTopic: result.isEndOfTopic, subNodes: result.subNodes, message: result.message };
  } catch (err: any) {
    if (err?.message === "API_KEY_MISSING") throw err;
    lastErr = err;
  }

  // See worthUngroundedRetry: grounding is an enhancement that a free-tier or unbilled key may not
  // be entitled to at all, and its rejection can look like a generic error.
  if (worthUngroundedRetry(kindOf(lastErr))) {
    try {
      const result = await singleShot(false);
      return {
        success: true,
        isEndOfTopic: result.isEndOfTopic,
        subNodes: result.subNodes,
        message: result.message,
        isUngrounded: true,
      };
    } catch (err: any) {
      if (err?.message === "API_KEY_MISSING") throw err;
      lastErr = err;
    }
  }

  if (worthSplitting(kindOf(lastErr))) {
    try {
      const failure = classifyFailure(lastErr);
      const split = await expandNodeViaSplit(
        callModel,
        { treeTopic, nodeId, nodeTitle, nodeDescription, ancestorChain, existingTitlesList, language },
        failure
      );
      return {
        success: true,
        isEndOfTopic: split.isEndOfTopic,
        subNodes: split.subNodes,
        isSplit: true,
        isPartial: split.partial,
      };
    } catch (err: any) {
      if (err?.message === "API_KEY_MISSING") throw err;
      lastErr = err;
    }
  }

  // Deliberately NOT isEndOfTopic: every ladder rung failed, but that is an API problem, not a
  // finding that the topic has nothing left to teach. Marking it end-of-topic would permanently
  // disable this branch's expand button (see markExpansionExhausted in App.tsx).
  return {
    success: true,
    isEndOfTopic: false,
    subNodes: [],
    isFallback: true,
    fallbackReason: kindOf(lastErr),
    fallbackDetail: detailOf(lastErr),
  };
}
