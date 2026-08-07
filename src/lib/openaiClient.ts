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

// OpenAI counterpart to geminiClient.ts - same shared prompt/dedup/assembly logic (llmShared.ts),
// just a different HTTP call and response shape. OpenAI has no built-in web-search grounding
// equivalent to Gemini's googleSearch tool available on plain chat completions, so resource URLs
// rely more heavily on sanitizeResourceUrl's fallback search links when the model isn't confident.

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5.1";

async function callOpenAiChat(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const err: any = new Error(errData?.error?.message || `OpenAI API error (${response.status})`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

export async function generateLearningTreeClient(
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree; isFallback?: boolean; fallbackReason?: FallbackReason }> {
  const apiKey = await getStoredApiKey("openai");
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const { topic, language = "he", depthLevel = "comprehensive", customInstructions = "" } = request;

  try {
    const prompt = buildGenerateTreePrompt(topic, language, depthLevel as any, customInstructions);
    const text = await callOpenAiChat(apiKey, prompt);

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
  const apiKey = await getStoredApiKey("openai");
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
    const text = await callOpenAiChat(apiKey, prompt);
    const data = parseJsonFromModelText(text);
    const result = assembleSubNodesFromParsedData(data, nodeId, existingTitlesList, treeTopic, nodeTitle, language);

    return { success: true, isEndOfTopic: result.isEndOfTopic, subNodes: result.subNodes, message: result.message };
  } catch (err: any) {
    if (err?.message === "API_KEY_MISSING") throw err;
    return { success: true, isEndOfTopic: false, subNodes: [], isFallback: true, fallbackReason: classifyProviderError(err) };
  }
}
