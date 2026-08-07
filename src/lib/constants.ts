// Shared safety ceiling for how many levels deep a learning tree branch may be expanded via AI.
// This is a fallback safety cap (to bound cost/runaway trees), not a target depth: expansion
// should normally stop earlier, on its own, once the anti-duplication logic (areTitlesDuplicateOrSimilar /
// areServerTitlesSimilar) determines there are no more distinct sub-topics to add for a node.
export const MAX_NODE_EXPANSION_DEPTH = 6;
