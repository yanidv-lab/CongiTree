import { GenerateTreeRequest, ExpandNodeRequest, LearningTree } from "../types";
import { LlmProvider, PROVIDER_INFO, getStoredProvider } from "./apiKeyStore";
import { FallbackReason } from "./llmShared";
import { RunResult } from "./llmRunner";
import * as geminiClient from "./geminiClient";
import * as openaiClient from "./openaiClient";
import * as anthropicClient from "./anthropicClient";

// Picks the provider client module the user has selected in Settings (defaults to Gemini) and
// forwards the call to it. App.tsx calls only these functions and never needs to know which
// provider is actually configured on the device.

export type { FallbackReason };

/**
 * Display name of the provider currently selected on this device, so error messages can name the
 * right service instead of always saying "Gemini".
 */
export async function getActiveProviderLabel(): Promise<string> {
  const provider: LlmProvider = await getStoredProvider();
  return PROVIDER_INFO[provider]?.label ?? provider;
}

export async function generateLearningTreeClient(
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree } & RunResult> {
  const provider = await getStoredProvider();
  if (provider === "openai") return openaiClient.generateLearningTreeClient(request);
  if (provider === "anthropic") return anthropicClient.generateLearningTreeClient(request);
  return geminiClient.generateLearningTreeClient(request);
}

export async function expandTreeNodeClient(
  request: ExpandNodeRequest
): Promise<{ success: boolean; isEndOfTopic?: boolean; subNodes?: any[]; message?: string } & RunResult> {
  const provider = await getStoredProvider();
  if (provider === "openai") return openaiClient.expandTreeNodeClient(request);
  if (provider === "anthropic") return anthropicClient.expandTreeNodeClient(request);
  return geminiClient.expandTreeNodeClient(request);
}
