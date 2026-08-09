import { GoogleGenAI } from "@google/genai";
import { getStoredApiKey } from "./apiKeyStore";
import { GenerateTreeRequest, ExpandNodeRequest, LearningTree } from "../types";
import { FallbackReason } from "./llmShared";
import { ModelCaller } from "./llmSplit";
import { RunResult, runExpandNode, runGenerateTree } from "./llmRunner";

export type { FallbackReason };

// Client-side counterpart to server.ts's Gemini calls, used when the packaged Android app can't
// reach our Express backend (a Capacitor app ships no bundled Node server) - calls Gemini
// directly from the device using the user's own key from apiKeyStore.
//
// This module owns only the HTTP call. Prompt text, JSON repair and tree assembly live in
// llmShared.ts; the retry / ungrounded-retry / split-and-reassemble escalation lives in
// llmRunner.ts, shared with the OpenAI and Anthropic clients so all three behave identically.

const MODEL = "gemini-3.6-flash";

function makeGeminiCaller(apiKey: string): ModelCaller {
  const ai = new GoogleGenAI({ apiKey });

  return async (prompt, opts) => {
    const config: any = { temperature: 0.2 };
    // Google Search grounding is what makes the resource links real rather than guessed, so it is
    // on by default - but it draws on a separate, much smaller quota than the model itself, which
    // is why the runner can ask for an ungrounded retry.
    if (opts?.grounded !== false) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({ model: MODEL, contents: prompt, config });
    return response.text || "";
  };
}

/**
 * Generate a learning tree directly from the client (Android standalone app mode).
 */
export async function generateLearningTreeClient(
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree } & RunResult> {
  const apiKey = await getStoredApiKey("gemini");
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return runGenerateTree(makeGeminiCaller(apiKey), request);
}

/**
 * Expand a tree node directly from the client (Android standalone app mode). Mirrors the server's
 * anti-repetition rules (existing titles + ancestor chain) so branch expansion doesn't regress to
 * lower-quality dedup once a device is running standalone.
 */
export async function expandTreeNodeClient(
  request: ExpandNodeRequest
): Promise<{ success: boolean; isEndOfTopic?: boolean; subNodes?: any[]; message?: string } & RunResult> {
  const apiKey = await getStoredApiKey("gemini");
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return runExpandNode(makeGeminiCaller(apiKey), request);
}
