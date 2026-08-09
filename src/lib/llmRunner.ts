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
//   1. One grounded single-shot call, with backoff retries for transient failures.
//   2. If grounding specifically ran out of quota, the same call again with grounding off.
//   3. If it still fails on a *short-term* limit (or the response came back truncated), rebuild
//      the same result from a small outline call plus spaced detail calls - see llmSplit.ts.
//   4. Only then fall back to canned content, tagged with the real reason.
//
// Steps 2 and 3 are the difference between "your quota is gone, here is filler" and actually
// getting the user's tree built.

export interface RunResult {
  /** Set when canned fallback content was substituted for real model output. */
  isFallback?: boolean;
  fallbackReason?: FailureKind;
  /** Set when the result was assembled from several smaller calls rather than one. */
  isSplit?: boolean;
  /** Set when some of those smaller calls failed and their nodes have no items/resources yet. */
  isPartial?: boolean;
}

/** A parse failure carries no HTTP status, so tag it explicitly for classifyFailure's callers. */
function parseFailureError(cause: unknown): Error & { kind: FailureKind } {
  const err = new Error(`Model response was not usable JSON: ${String((cause as any)?.message ?? cause)}`) as Error & {
    kind: FailureKind;
  };
  err.kind = 'parse_error';
  return err;
}

function kindOf(err: any): FailureKind {
  return err?.kind === 'parse_error' ? 'parse_error' : classifyFailure(err).kind;
}

/** Worth rebuilding as several smaller calls? Burst limits and truncated output, yes. Dead key, no. */
function worthSplitting(kind: FailureKind): boolean {
  return isSplittable(kind) || kind === 'parse_error';
}

export async function runGenerateTree(
  callModel: ModelCaller,
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree } & RunResult> {
  const { topic, language = "he", depthLevel = "comprehensive", customInstructions = "" } = request;
  const prompt = buildGenerateTreePrompt(topic, language, depthLevel as any, customInstructions);

  const singleShot = async (grounded: boolean): Promise<LearningTree> => {
    const text = await withBurstRetry(() => callModel(prompt, { grounded }), { attempts: 3 });
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

  // Grounding has its own, much smaller quota than the model itself, so a grounded call can fail
  // while the identical ungrounded call succeeds. Resource URLs then lean on sanitizeResourceUrl's
  // fallback links instead of live search results - a real tree with weaker links.
  if (kindOf(lastErr) === 'grounding_limit') {
    try {
      return { success: true, tree: await singleShot(false) };
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
    const text = await withBurstRetry(() => callModel(prompt, { grounded }), { attempts: 3 });
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

  if (kindOf(lastErr) === 'grounding_limit') {
    try {
      const result = await singleShot(false);
      return { success: true, isEndOfTopic: result.isEndOfTopic, subNodes: result.subNodes, message: result.message };
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
  };
}
