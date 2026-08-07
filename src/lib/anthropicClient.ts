import { getStoredApiKey } from "./apiKeyStore";
import { MAX_NODE_EXPANSION_DEPTH } from "./constants";
import { GenerateTreeRequest, ExpandNodeRequest, LearningTree } from "../types";
import {
  FallbackReason,
  classifyProviderError,
  parseJsonFromModelText,
  buildFallbackTree,
  buildGenerateTreePrompt,
  buildExpandNodePrompt,
  assembleTreeFromParsedData,
  assembleSubNodesFromParsedData,
} from "./llmShared";

// Anthropic counterpart to geminiClient.ts - same shared prompt/dedup/assembly logic
// (llmShared.ts), just a different HTTP call and response shape. Calls the Messages API directly
// from the browser with the user's own key; anthropic-dangerous-direct-browser-access is required
// for that (Anthropic blocks browser-origin requests by default since the key would otherwise be
// exposed in the page - acceptable here because the key is the *user's own*, entered by them for
// their own on-device use, not one baked into the app).

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

async function callAnthropicMessages(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 8192,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const err: any = new Error(errData?.error?.message || `Anthropic API error (${response.status})`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return (data?.content || [])
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("");
}

export async function generateLearningTreeClient(
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree; isFallback?: boolean; fallbackReason?: FallbackReason }> {
  const apiKey = await getStoredApiKey("anthropic");
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const { topic, language = "he", depthLevel = "comprehensive", customInstructions = "" } = request;

  try {
    const prompt = buildGenerateTreePrompt(topic, language, depthLevel as any, customInstructions);
    const text = await callAnthropicMessages(apiKey, prompt);

    let parsedTreeData: any;
    try {
      parsedTreeData = parseJsonFromModelText(text);
    } catch (parseErr) {
      return { success: true, tree: buildFallbackTree(topic, language as any), isFallback: true, fallbackReason: "parse_error" };
    }

    const learningTree = assembleTreeFromParsedData(parsedTreeData, topic, language);
    return { success: true, tree: learningTree };
  } catch (err: any) {
    if (err?.message === "API_KEY_MISSING") throw err;
    return { success: true, tree: buildFallbackTree(topic, language as any), isFallback: true, fallbackReason: classifyProviderError(err) };
  }
}

export async function expandTreeNodeClient(
  request: ExpandNodeRequest
): Promise<{ success: boolean; isEndOfTopic?: boolean; subNodes?: any[]; message?: string; isFallback?: boolean; fallbackReason?: FallbackReason }> {
  const apiKey = await getStoredApiKey("anthropic");
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const { treeTopic, nodeId, nodeTitle, nodeDescription, nodeDepth = 0, ancestors = [], existingTreeContext = "", language = "he" } = request;
  const isHe = language === 'he';

  if (nodeDepth >= MAX_NODE_EXPANSION_DEPTH) {
    return {
      success: true,
      isEndOfTopic: true,
      subNodes: [],
      message: isHe ? "הענף הגיע לעומק מפורט מרבי" : "Branch reached maximum depth level",
    };
  }

  const existingTitlesList: string[] = existingTreeContext
    ? existingTreeContext.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const ancestorChain = Array.isArray(ancestors) ? ancestors.filter(Boolean) : [];

  try {
    const prompt = buildExpandNodePrompt(treeTopic, nodeTitle, nodeDescription, nodeDepth, ancestorChain, existingTitlesList, language);
    const text = await callAnthropicMessages(apiKey, prompt);
    const data = parseJsonFromModelText(text);
    const result = assembleSubNodesFromParsedData(data, nodeId, existingTitlesList, treeTopic, nodeTitle, language);

    return { success: true, isEndOfTopic: result.isEndOfTopic, subNodes: result.subNodes, message: result.message };
  } catch (err: any) {
    if (err?.message === "API_KEY_MISSING") throw err;
    return { success: true, isEndOfTopic: false, subNodes: [], isFallback: true, fallbackReason: classifyProviderError(err) };
  }
}
