// Failure classification and burst-retry policy shared by the server (server.ts) and all three
// on-device provider clients (geminiClient / openaiClient / anthropicClient).
//
// The point of this module is that "HTTP 429" is not one thing. Gemini, OpenAI and Anthropic all
// return 429 for at least two very different situations:
//
//   * a SHORT-TERM burst limit (requests-per-minute, tokens-per-minute) - the key is fine, the
//     work just has to be spread out. Retrying, or splitting the work into smaller pieces, works.
//   * a HARD quota being gone (daily free-tier cap, exhausted prepaid credits) - retrying in a few
//     seconds changes nothing, and telling the user "try again in a few minutes" is wrong.
//
// Gemini adds a third: the Google Search *grounding* quota is separate from - and much smaller
// than - the model's own quota, so grounded calls start failing while plain calls still work fine.
//
// Previously all of these collapsed into one `rate_limit` reason whose user-facing text asserted
// the API key's quota was used up. That claim was frequently false, and it was the only signal the
// user got, so a transient minute-level limit looked identical to a dead key.

export type FailureKind =
  // Transient: the request was too much *right now*. Retry and/or split will get through.
  | 'rate_limit'
  // Grounded-search quota specifically. The same prompt without search grounding may succeed.
  | 'grounding_limit'
  // Hard limit: daily cap reached, or prepaid credits/billing exhausted. Retrying won't help.
  | 'quota_exhausted'
  // Key missing, invalid, or lacking permission for the model.
  | 'auth_error'
  // The backend deployment itself has no key configured (not the user's fault, not their key).
  | 'server_key_missing'
  // Model replied, but not with usable JSON.
  | 'parse_error'
  // Anything else (network, 5xx, timeouts).
  | 'api_error';

export interface ProviderFailure {
  kind: FailureKind;
  /** HTTP status, when the provider gave one. */
  status?: number;
  /** Server-suggested wait before retrying, in ms (from Retry-After / retryDelay). */
  retryAfterMs?: number;
  /** Short provider-supplied detail, safe to log. Never contains the API key. */
  detail?: string;
}

/** True for failures where retrying the same call, or splitting it up, can realistically succeed. */
export function isTransient(kind: FailureKind): boolean {
  return kind === 'rate_limit' || kind === 'grounding_limit' || kind === 'api_error';
}

/** True for failures a smaller/split request can get past (burst limits, not hard caps). */
export function isSplittable(kind: FailureKind): boolean {
  return kind === 'rate_limit' || kind === 'grounding_limit';
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

/**
 * Collect every string we can reach on a provider error into one lowercased haystack: the message,
 * a parsed JSON body if the client attached one, and the raw response text. Providers disagree on
 * where they put the useful discriminator (`status`, `error.code`, `error.status`, `quotaMetric`,
 * `violations[].quotaId`), so matching over the flattened text is more robust than reading any one
 * field - and it degrades gracefully when a provider changes its shape.
 */
function haystackOf(err: any): string {
  const parts: string[] = [lower(err?.message)];
  const body = err?.body ?? err?.error ?? err?.response?.data;
  if (body) {
    try {
      parts.push(JSON.stringify(body).toLowerCase());
    } catch {
      /* circular or non-serializable - the message alone will have to do */
    }
  }
  if (typeof err?.responseText === 'string') parts.push(err.responseText.toLowerCase());
  return parts.filter(Boolean).join(' | ');
}

function statusOf(err: any): number | undefined {
  const raw = err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.error?.code;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/**
 * Parse the provider's own "wait this long" hint. Gemini returns a RetryInfo detail with
 * `retryDelay: "27s"`, OpenAI/Anthropic use the `Retry-After` header (seconds, or an HTTP date)
 * which the calling client copies onto the error as `retryAfter`.
 */
export function retryAfterMsFrom(err: any): number | undefined {
  const header = err?.retryAfter ?? err?.headers?.['retry-after'] ?? err?.response?.headers?.['retry-after'];
  if (header !== undefined && header !== null) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
    const asDate = Date.parse(String(header));
    if (Number.isFinite(asDate)) return Math.min(Math.max(asDate - Date.now(), 0), 60_000);
  }
  // Gemini: {"error":{"details":[{"@type":"...RetryInfo","retryDelay":"27s"}]}}
  const match = haystackOf(err).match(/"retrydelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (match) return Math.min(Number(match[1]) * 1000, 60_000);
  return undefined;
}

/**
 * Decide what actually went wrong. Ordering matters: the hard-limit checks run before the generic
 * 429 check, because a daily-cap 429 and a per-minute 429 are the same status code and only the
 * body text tells them apart.
 */
export function classifyFailure(err: any): ProviderFailure {
  const status = statusOf(err);
  const text = haystackOf(err);
  const retryAfterMs = retryAfterMsFrom(err);
  const detail = typeof err?.message === 'string' ? err.message.slice(0, 300) : undefined;

  if (err?.message === 'SERVER_KEY_MISSING' || text.includes('gemini_api_key environment variable')) {
    return { kind: 'server_key_missing', status, detail };
  }

  // Auth first: a bad key can surface as 400 on some providers, so don't let a text match on
  // "quota" or "limit" elsewhere in the body shadow it.
  const isAuth =
    status === 401 || status === 403 ||
    text.includes('api_key_invalid') || text.includes('invalid_api_key') || text.includes('invalid x-api-key') ||
    text.includes('permission_denied') || text.includes('authentication_error') || text.includes('permission_error') ||
    text.includes('unauthenticated') || text.includes('incorrect api key');
  if (isAuth) return { kind: 'auth_error', status, detail };

  // Grounding quota is checked before the generic rate-limit branch: it is the one 429 that a
  // *differently shaped* retry (same prompt, search grounding off) reliably gets past.
  const mentionsGrounding =
    text.includes('google_search') || text.includes('googlesearch') ||
    text.includes('grounding') || text.includes('search grounding');
  if (mentionsGrounding && (status === 429 || text.includes('resource_exhausted') || text.includes('quota'))) {
    return { kind: 'grounding_limit', status, retryAfterMs, detail };
  }

  // Hard limits - retrying in seconds will not help, so never tell the user to "try again shortly".
  const isHardQuota =
    text.includes('insufficient_quota') ||                    // OpenAI: billing quota gone
    text.includes('exceeded your current quota') ||           // OpenAI
    text.includes('credit balance is too low') ||             // Anthropic: prepaid credits gone
    text.includes('billing') || text.includes('payment') ||
    text.includes('per day') || text.includes('perday') ||    // Gemini: daily free-tier cap
    text.includes('per-day') || text.includes('requests_per_day') ||
    text.includes('daily limit') || text.includes('quota_exceeded');
  if (isHardQuota) return { kind: 'quota_exhausted', status, retryAfterMs, detail };

  // Everything else that looks like a limit is treated as a short-term burst limit, which is the
  // recoverable interpretation - we retry and split rather than declaring the key dead.
  const isBurst =
    status === 429 ||
    text.includes('resource_exhausted') || text.includes('rate_limit') || text.includes('rate limit') ||
    text.includes('too many requests') || text.includes('per minute') || text.includes('perminute') ||
    text.includes('overloaded');
  if (isBurst) return { kind: 'rate_limit', status, retryAfterMs, detail };

  return { kind: 'api_error', status, retryAfterMs, detail };
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface BurstRetryOptions {
  /** Total attempts including the first one. */
  attempts?: number;
  /** Base delay for exponential backoff when the provider gives no Retry-After. */
  baseDelayMs?: number;
  /** Upper bound on any single wait. */
  maxDelayMs?: number;
  /** Called before each retry, for logging / UI progress. */
  onRetry?: (info: { attempt: number; waitMs: number; failure: ProviderFailure }) => void;
}

/**
 * Run `fn`, retrying only failures that a wait can actually fix. A hard quota, an auth error or a
 * missing server key throws immediately - retrying those just adds latency before the same message.
 * The provider's own Retry-After is honoured when present; otherwise exponential backoff with
 * jitter, so several nodes expanding at once don't re-collide on the same second.
 */
export async function withBurstRetry<T>(fn: () => Promise<T>, options: BurstRetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 1200, maxDelayMs = 30_000, onRetry } = options;
  let lastErr: any;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const failure = classifyFailure(err);
      if (!isTransient(failure.kind) || attempt === attempts) throw err;

      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const jitter = Math.floor(Math.random() * 400);
      const waitMs = Math.min(failure.retryAfterMs ?? backoff + jitter, maxDelayMs);
      onRetry?.({ attempt, waitMs, failure });
      await sleep(waitMs);
    }
  }

  throw lastErr;
}

/**
 * Spacing between the individual calls of a split request. Free-tier Gemini allows roughly 15
 * requests/minute, so ~4s apart keeps a split sequence under the limit that made us split in the
 * first place; if the provider told us how long to wait, that wins.
 */
export const SPLIT_CALL_SPACING_MS = 4000;

export function spacingFor(failure: ProviderFailure | undefined): number {
  const suggested = failure?.retryAfterMs;
  if (suggested && suggested > SPLIT_CALL_SPACING_MS) return Math.min(suggested, 20_000);
  return SPLIT_CALL_SPACING_MS;
}
