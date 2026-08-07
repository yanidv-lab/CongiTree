import { GenerateTreeRequest, ExpandNodeRequest, LearningTree } from "../types";
import { getStoredProvider } from "./apiKeyStore";
import { FallbackReason } from "./llmShared";
import * as geminiClient from "./geminiClient";
import * as openaiClient from "./openaiClient";
import * as anthropicClient from "./anthropicClient";

// Picks the provider client module the user has selected in Settings (defaults to Gemini) and
// forwards the call to it. App.tsx calls only these two functions and never needs to know which
// provider is actually configured on the device.

export type { FallbackReason };

export async function generateLearningTreeClient(
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree; isFallback?: boolean; fallbackReason?: FallbackReason }> {
  const provider = await getStoredProvider();
  if (provider === "openai") return openaiClient.generateLearningTreeClient(request);
  if (provider === "anthropic") return anthropicClient.generateLearningTreeClient(request);
  return geminiClient.generateLearningTreeClient(request);
}

export async function expandTreeNodeClient(
  request: ExpandNodeRequest
): Promise<{ success: boolean; isEndOfTopic?: boolean; subNodes?: any[]; message?: string; isFallback?: boolean; fallbackReason?: FallbackReason }> {
  const provider = await getStoredProvider();
  if (provider === "openai") return openaiClient.expandTreeNodeClient(request);
  if (provider === "anthropic") return anthropicClient.expandTreeNodeClient(request);
  return geminiClient.expandTreeNodeClient(request);
}
