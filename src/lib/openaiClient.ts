import { getStoredApiKey } from "./apiKeyStore";
import { GenerateTreeRequest, ExpandNodeRequest, LearningTree } from "../types";
import { FallbackReason } from "./llmShared";
import { ModelCaller } from "./llmSplit";
import { RunResult, runExpandNode, runGenerateTree } from "./llmRunner";

export type { FallbackReason };

// OpenAI counterpart to geminiClient.ts - same shared prompt/dedup/assembly logic (llmShared.ts)
// and the same retry/split escalation (llmRunner.ts), just a different HTTP call and response
// shape. OpenAI has no built-in web-search grounding equivalent to Gemini's googleSearch tool
// available on plain chat completions, so resource URLs rely more heavily on sanitizeResourceUrl's
// fallback search links when the model isn't confident.

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5.1";

function makeOpenAiCaller(apiKey: string): ModelCaller {
  return async (prompt) => {
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
      // OpenAI returns 429 both for a per-minute rate limit and for `insufficient_quota` (billing
      // exhausted). Only the body distinguishes them, so classifyFailure needs it.
      err.body = errData;
      err.retryAfter = response.headers.get("retry-after") ?? undefined;
      throw err;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "";
  };
}

export async function generateLearningTreeClient(
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree } & RunResult> {
  const apiKey = await getStoredApiKey("openai");
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return runGenerateTree(makeOpenAiCaller(apiKey), request);
}

export async function expandTreeNodeClient(
  request: ExpandNodeRequest
): Promise<{ success: boolean; isEndOfTopic?: boolean; subNodes?: any[]; message?: string } & RunResult> {
  const apiKey = await getStoredApiKey("openai");
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return runExpandNode(makeOpenAiCaller(apiKey), request);
}
