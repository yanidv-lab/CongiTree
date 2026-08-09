import { getStoredApiKey } from "./apiKeyStore";
import { GenerateTreeRequest, ExpandNodeRequest, LearningTree } from "../types";
import { FallbackReason } from "./llmShared";
import { ModelCaller } from "./llmSplit";
import { RunResult, runExpandNode, runGenerateTree } from "./llmRunner";

export type { FallbackReason };

// Anthropic counterpart to geminiClient.ts - same shared prompt/dedup/assembly logic
// (llmShared.ts) and the same retry/split escalation (llmRunner.ts), just a different HTTP call
// and response shape. Calls the Messages API directly from the browser with the user's own key;
// anthropic-dangerous-direct-browser-access is required for that (Anthropic blocks browser-origin
// requests by default since the key would otherwise be exposed in the page - acceptable here
// because the key is the *user's own*, entered by them for their own on-device use, not one baked
// into the app).

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

function makeAnthropicCaller(apiKey: string): ModelCaller {
  // Anthropic has no search-grounding equivalent on plain Messages calls, so `grounded` is ignored;
  // resource URLs lean on sanitizeResourceUrl's fallback links when the model isn't confident.
  return async (prompt) => {
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
      // classifyFailure reads the body and Retry-After to tell a one-minute rate limit apart from
      // an exhausted credit balance - both of which Anthropic can report on a single status code.
      err.body = errData;
      err.retryAfter = response.headers.get("retry-after") ?? undefined;
      throw err;
    }

    const data = await response.json();
    return (data?.content || [])
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("");
  };
}

export async function generateLearningTreeClient(
  request: GenerateTreeRequest
): Promise<{ success: boolean; tree: LearningTree } & RunResult> {
  const apiKey = await getStoredApiKey("anthropic");
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return runGenerateTree(makeAnthropicCaller(apiKey), request);
}

export async function expandTreeNodeClient(
  request: ExpandNodeRequest
): Promise<{ success: boolean; isEndOfTopic?: boolean; subNodes?: any[]; message?: string } & RunResult> {
  const apiKey = await getStoredApiKey("anthropic");
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return runExpandNode(makeAnthropicCaller(apiKey), request);
}
