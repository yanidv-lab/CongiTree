import { LearningTree } from "../types";
import {
  ProviderFailure,
  classifyFailure,
  isSplittable,
  spacingFor,
  sleep,
  withBurstRetry,
} from "./llmResilience";
import {
  areTitlesSimilar,
  assembleTreeFromParsedData,
  depthGuidanceFor,
  parseJsonFromModelText,
  sanitizeResourceUrl,
} from "./llmShared";

// Split-and-reassemble strategy for requests that fail on a SHORT-TERM burst limit.
//
// A single "build me a whole learning tree" call asks for 8-12 nodes x (3-5 checklist items +
// 4-6 researched resources) in one response. That is a large output in one shot, and on a
// free/low tier it is exactly the shape that trips a tokens-per-minute or output-size limit even
// though the key has plenty of quota left overall.
//
// So when a call fails with a *transient* limit (never a hard quota, never an auth error), instead
// of giving up and substituting canned filler we decompose the same work:
//
//   1. OUTLINE  - one small call that returns only titles/descriptions/levels. Tiny output.
//   2. DETAIL   - a few small calls, spaced apart in time, each filling in the checklist items and
//                 resources for a couple of nodes at a time.
//   3. REASSEMBLE - stitch the pieces back into exactly the same tree/sub-node shape the
//                 single-shot path produces, so nothing downstream can tell the difference.
//
// Each individual call is far under the burst limit, and the spacing between them lets the
// provider's token bucket refill. The result is slower than the single-shot path but real - it is
// the model's own researched content, not the generic fallback tree.
//
// If a DETAIL call still fails, that node keeps its outline (title + description) and loses only
// its items/resources; the run is reported as `partial` rather than thrown away. A half-detailed
// real tree beats a fully-detailed fake one.

/**
 * A provider-agnostic single call to the model. `grounded` asks for web-search grounding where the
 * provider supports it (Gemini); providers without it ignore the flag. Split calls always request
 * ungrounded output - grounding has its own separate, smaller quota, and it is the first thing to
 * run out.
 */
export type ModelCaller = (prompt: string, opts?: { grounded?: boolean }) => Promise<string>;

/** How many nodes one DETAIL call covers. Small enough to stay well under a burst limit. */
const TREE_DETAIL_BATCH = 3;
const EXPAND_DETAIL_BATCH = 2;

export interface SplitOutcome {
  /** True when at least one DETAIL call failed and its nodes kept outline-only content. */
  partial: boolean;
}

function detailSchemaBlock(isHe: boolean): string {
  return `{
  "details": [
    {
      "title": "must repeat the node title exactly as given",
      "items": ["${isHe ? 'משימת לימוד 1' : 'Learning objective 1'}", "${isHe ? 'משימת לימוד 2' : 'Learning objective 2'}"],
      "resources": [
        {
          "title": "Specific course / video / book title",
          "type": "youtube | course_free | course_paid | book | article | doc",
          "url": "https://...",
          "provider": "Coursera / edX / MIT OCW / YouTube channel",
          "description": "Why this resource helps",
          "isVerifiedAcademic": true
        }
      ]
    }
  ]
}`;
}

function buildDetailPrompt(
  treeTopic: string,
  batch: { title: string; description: string }[],
  language: string,
  resourcesPerNode: string
): string {
  const isHe = language === 'he';
  return `You are an expert academic curriculum designer working on a learning pathway for: "${treeTopic}".

For EACH of the following topics, produce its checklist items and its study resources. Do not add,
rename, merge or drop topics - return exactly one entry per topic, in the same order.

${batch.map((n, i) => `${i + 1}. "${n.title}" - ${n.description || '(no description)'}`).join('\n')}

Requirements:
- 3 to 5 concrete checklist items per topic.
- ${resourcesPerNode} real, verified study resources per topic (university courses, YouTube lectures, textbooks, academic papers, official documentation).
- IF YOU ARE NOT CONFIDENT A SPECIFIC URL IS CORRECT AND CURRENTLY VALID, LEAVE "url" AS AN EMPTY STRING ("") INSTEAD OF GUESSING - a working fallback link is supplied automatically whenever "url" is empty, and a confidently wrong link is worse than an empty one.
- STRICTLY FORBIDDEN: generic homepage or search-engine URLs.
- ${isHe ? 'Write every item, title and description in clear, natural HEBREW.' : 'Write every item, title and description clearly in ENGLISH.'}

Return ONLY a valid JSON object (no prose outside JSON):
${detailSchemaBlock(isHe)}`;
}

/** Index the model's detail entries so a batch can be matched back by position, then by title. */
function indexDetails(parsed: any): { byIndex: any[]; byTitle: Map<string, any> } {
  const list = Array.isArray(parsed?.details) ? parsed.details : Array.isArray(parsed) ? parsed : [];
  const byTitle = new Map<string, any>();
  list.forEach((d: any) => {
    const key = (d?.title || '').trim().toLowerCase();
    if (key) byTitle.set(key, d);
  });
  return { byIndex: list, byTitle };
}

function pickDetail(indexed: { byIndex: any[]; byTitle: Map<string, any> }, title: string, position: number): any {
  const byTitle = indexed.byTitle.get(title.trim().toLowerCase());
  if (byTitle) return byTitle;
  // Fall back to position: the prompt pins order explicitly, and a model that reworded a Hebrew
  // title slightly should not cost the node its whole detail payload.
  return indexed.byIndex[position];
}

function toItems(raw: any, idPrefix: string, isHe: boolean) {
  if (!Array.isArray(raw)) return [];
  return raw.map((it: any, i: number) => ({
    id: `${idPrefix}_item_${i}`,
    text: typeof it === 'string' ? it : it?.text || (isHe ? 'נושא ללמידה' : 'Topic to learn'),
    completed: false,
  }));
}

function toResources(raw: any, idPrefix: string, fallbackTitle: string, treeTopic: string, isHe: boolean) {
  if (!Array.isArray(raw)) return [];
  return raw.map((res: any, i: number) => ({
    id: `${idPrefix}_res_${i}`,
    title: res?.title || (isHe ? 'מקור לימוד' : 'Learning Resource'),
    type: res?.type || 'article',
    url: sanitizeResourceUrl(res?.url, res?.title || fallbackTitle, treeTopic, res?.type || 'article'),
    provider: res?.provider || (isHe ? 'מקור אקדמי' : 'Academic Source'),
    description: res?.description || '',
    isVerifiedAcademic: res?.isVerifiedAcademic ?? true,
    completed: false,
  }));
}

/**
 * Walk `entries` in batches, calling the model once per batch with `spacingMs` between calls, and
 * hand each entry its parsed detail object (or `undefined` when that batch failed). Never throws
 * for a failed batch - a batch failure degrades that batch to outline-only.
 */
async function hydrateInBatches<T extends { title: string; description: string }>(
  callModel: ModelCaller,
  treeTopic: string,
  entries: T[],
  language: string,
  batchSize: number,
  resourcesPerNode: string,
  spacingMs: number,
  onDetail: (entry: T, detail: any | undefined) => void
): Promise<{ partial: boolean }> {
  let partial = false;

  for (let start = 0; start < entries.length; start += batchSize) {
    const batch = entries.slice(start, start + batchSize);
    if (start > 0) await sleep(spacingMs);

    let indexed: { byIndex: any[]; byTitle: Map<string, any> } | null = null;
    try {
      const prompt = buildDetailPrompt(treeTopic, batch, language, resourcesPerNode);
      const text = await withBurstRetry(() => callModel(prompt, { grounded: false }), { attempts: 3 });
      indexed = indexDetails(parseJsonFromModelText(text));
    } catch {
      // This batch stays outline-only. Keep going: later batches often succeed once the bucket
      // has refilled, and a tree missing resources on 3 of 10 nodes is still worth delivering.
      partial = true;
    }

    batch.forEach((entry, i) => {
      onDetail(entry, indexed ? pickDetail(indexed, entry.title, i) : undefined);
    });
  }

  return { partial };
}

// ---------------------------------------------------------------------------
// Learning tree
// ---------------------------------------------------------------------------

function buildTreeOutlinePrompt(
  topic: string,
  language: string,
  depthLevel: 'basic' | 'comprehensive' | 'mastery'
): string {
  const isHe = language === 'he';
  return `You are an expert academic curriculum designer and knowledge tree builder.
Outline a visual learning pathway tree for the topic: "${topic.trim()}".
Language requested: ${isHe ? 'Hebrew (עברית)' : 'English'}.

Return ONLY the STRUCTURE - titles, descriptions and hierarchy. Do NOT include checklist items or
resources; those are requested separately.

Requested scope: ${depthGuidanceFor(depthLevel)}

Return ONLY a valid JSON object (no prose outside JSON):
{
  "topic": "${topic.trim()}",
  "description": "A comprehensive summary of the topic learning pathway",
  "nodes": [
    {
      "id": "node_root",
      "title": "Root Topic Title",
      "description": "Overview of the root topic",
      "level": "foundation | core | advanced | specialization",
      "isBaseNode": true,
      "parentId": null
    }
  ]
}

Instructions:
- The FIRST node is the root and must have "parentId": null. Every other node must reference an existing node id in "parentId".
- Avoid duplicate or highly overlapping node titles.
- ${isHe ? 'Write titles and descriptions in clear, natural HEBREW.' : 'Write titles and descriptions clearly in ENGLISH.'}`;
}

/**
 * Build a full learning tree using the outline + spaced detail calls described at the top of this
 * file. Used only after a single-shot attempt has failed with a transient burst limit.
 */
export async function generateTreeViaSplit(
  callModel: ModelCaller,
  topic: string,
  language: string,
  depthLevel: 'basic' | 'comprehensive' | 'mastery',
  failure?: ProviderFailure
): Promise<{ tree: LearningTree } & SplitOutcome> {
  const spacingMs = spacingFor(failure);
  const isHe = language === 'he';

  const outlineText = await withBurstRetry(
    () => callModel(buildTreeOutlinePrompt(topic, language, depthLevel), { grounded: false }),
    { attempts: 3 }
  );
  const outline = parseJsonFromModelText(outlineText);

  const rawNodes: any[] = Array.isArray(outline?.nodes) ? outline.nodes : [];
  if (rawNodes.length === 0) {
    throw new Error('Split outline returned no nodes');
  }

  const entries = rawNodes.map((n: any, i: number) => ({
    title: (n?.title || (isHe ? `שלב ${i + 1}` : `Step ${i + 1}`)).trim(),
    description: n?.description || '',
    raw: n,
  }));

  const detailByTitle = new Map<string, any>();
  const { partial } = await hydrateInBatches(
    callModel,
    topic,
    entries,
    language,
    TREE_DETAIL_BATCH,
    '4 to 6',
    spacingMs,
    (entry, detail) => {
      if (detail) detailByTitle.set(entry.title, detail);
    }
  );

  // Feed the merged outline+detail back through the exact same assembler the single-shot path
  // uses, so childrenIds wiring, URL sanitisation and id generation stay identical.
  const merged = {
    topic: outline?.topic || topic,
    description: outline?.description,
    nodes: entries.map((entry) => {
      const detail = detailByTitle.get(entry.title);
      return {
        ...entry.raw,
        title: entry.title,
        items: Array.isArray(detail?.items) ? detail.items : [],
        resources: Array.isArray(detail?.resources) ? detail.resources : [],
      };
    }),
  };

  return { tree: assembleTreeFromParsedData(merged, topic, language), partial };
}

// ---------------------------------------------------------------------------
// Node expansion
// ---------------------------------------------------------------------------

function buildExpandOutlinePrompt(
  treeTopic: string,
  nodeTitle: string,
  nodeDescription: string,
  ancestorChain: string[],
  existingTitlesList: string[],
  language: string
): string {
  const isHe = language === 'he';
  return `You are an expert academic curriculum designer.
We are building a structured learning pathway tree for the general subject: "${treeTopic}".
Outline sub-branches for this node:
Node Title: "${nodeTitle}"
Node Description: "${nodeDescription}"
Ancestor Hierarchy Chain: ${ancestorChain.length > 0 ? ancestorChain.map((a) => `"${a}"`).join(' -> ') : 'Root Topic'}

Return ONLY the STRUCTURE - titles, descriptions and levels. Do NOT include checklist items or
resources; those are requested separately.

CRITICAL STRICT ANTI-REPETITION RULES:
1. Existing nodes ALREADY in this learning tree:
${existingTitlesList.map((t) => `- "${t}"`).join('\n')}
2. Do NOT return a sub-branch that teaches essentially the same thing as any title above. Being about the same general parent subject is EXPECTED and FINE - only reject a candidate that would be a near-duplicate.
3. If "${nodeTitle}" cannot be broken into distinct, brand-new sub-topics, RETURN AN EMPTY ARRAY [].

Language requested: ${isHe ? 'Hebrew (עברית)' : 'English'}.

Return ONLY a valid JSON object (no prose outside JSON):
{
  "expandedSubNodes": [
    { "title": "Detailed Distinct Sub-Branch Title", "description": "Specific focus area explanation", "level": "core | advanced | specialization" }
  ]
}`;
}

/**
 * Expand a node using the outline + spaced detail calls. Used only after a single-shot expand has
 * failed with a transient burst limit.
 */
export async function expandNodeViaSplit(
  callModel: ModelCaller,
  params: {
    treeTopic: string;
    nodeId: string;
    nodeTitle: string;
    nodeDescription: string;
    ancestorChain: string[];
    existingTitlesList: string[];
    language: string;
  },
  failure?: ProviderFailure
): Promise<{ subNodes: any[]; isEndOfTopic: boolean } & SplitOutcome> {
  const { treeTopic, nodeId, nodeTitle, nodeDescription, ancestorChain, existingTitlesList, language } = params;
  const isHe = language === 'he';
  const spacingMs = spacingFor(failure);

  const outlineText = await withBurstRetry(
    () => callModel(
      buildExpandOutlinePrompt(treeTopic, nodeTitle, nodeDescription, ancestorChain, existingTitlesList, language),
      { grounded: false }
    ),
    { attempts: 3 }
  );
  const outline = parseJsonFromModelText(outlineText);

  const raw: any[] = Array.isArray(outline?.expandedSubNodes) ? outline.expandedSubNodes : [];

  // Same dedup bar as the single-shot path, applied to the outline before we spend any detail
  // calls on candidates that would be discarded anyway.
  const seen = new Set<string>();
  const entries = raw
    .map((n: any) => ({ title: (n?.title || '').trim(), description: n?.description || '', level: n?.level || 'core' }))
    .filter((n) => {
      if (!n.title) return false;
      if (existingTitlesList.some((ex) => areTitlesSimilar(n.title, ex))) return false;
      if (Array.from(seen).some((prev) => areTitlesSimilar(n.title, prev))) return false;
      seen.add(n.title);
      return true;
    });

  if (entries.length === 0) {
    return { subNodes: [], isEndOfTopic: true, partial: false };
  }

  const timestamp = Date.now();
  const subNodes: any[] = [];

  const { partial } = await hydrateInBatches(
    callModel,
    treeTopic,
    entries,
    language,
    EXPAND_DETAIL_BATCH,
    '2 to 4',
    spacingMs,
    (entry, detail) => {
      const subId = `${nodeId}_sub_${timestamp}_${subNodes.length}`;
      subNodes.push({
        id: subId,
        title: entry.title,
        description: entry.description,
        level: (entry as any).level || 'core',
        isBaseNode: false,
        parentId: nodeId,
        childrenIds: [],
        completed: false,
        items: toItems(detail?.items, subId, isHe),
        resources: toResources(detail?.resources, subId, entry.title, treeTopic, isHe),
      });
    }
  );

  return { subNodes, isEndOfTopic: subNodes.length === 0, partial };
}

/**
 * Decide whether a failed single-shot call is worth retrying as a split request. Hard quota, auth
 * errors and a missing server key are all unaffected by making the request smaller.
 *
 * `parse_error` counts as splittable: the usual cause is a response large enough to get truncated
 * mid-JSON, and every split call asks for a fraction of that output.
 */
export function shouldSplit(err: any): ProviderFailure | null {
  const failure = classifyFailure(err);
  if (isSplittable(failure.kind)) return failure;
  if (failure.kind === 'parse_error') return failure;
  return null;
}
