/**
 * Retry with exponential backoff + full jitter.
 *
 * Only *transient* failures are retried: rate limits (429), overload / server errors (5xx, 529),
 * request timeouts and network errors. Things that will never succeed on a retry — a bad API key
 * (401), a malformed request (400), a missing model (404) — fail immediately with a clear message.
 */

export class HttpError extends Error {
  override name = "HttpError";
  constructor(
    readonly status: number,
    message: string,
    /** Seconds from a Retry-After header, if the server sent one. */
    readonly retryAfterSec?: number,
  ) {
    super(message);
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const RETRYABLE_NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT"]);

export function isTransient(err: unknown): boolean {
  if (err instanceof HttpError) return RETRYABLE_STATUS.has(err.status);
  if (err instanceof Error) {
    // AbortSignal.timeout() -> TimeoutError; fetch network failure -> TypeError("fetch failed") with a cause code.
    if (err.name === "TimeoutError" || err.name === "AbortError") return true;
    const code = (err as { code?: string }).code ?? ((err as { cause?: { code?: string } }).cause?.code);
    if (code && RETRYABLE_NETWORK_CODES.has(code)) return true;
    if (err instanceof TypeError && /fetch failed|network/i.test(err.message)) return true;
  }
  return false;
}

export interface RetryOptions {
  /** Number of retries after the first attempt (so total attempts = retries + 1). */
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Called before each retry — used to log "retrying in 1.2 s…". */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  /** Injected in tests so they don't actually wait. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const { retries, baseDelayMs = 500, maxDelayMs = 8_000, onRetry, sleep = defaultSleep, random = Math.random } = opts;

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt > retries || !isTransient(err)) throw err;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      let delayMs = Math.round(random() * backoff); // full jitter
      if (err instanceof HttpError && err.retryAfterSec !== undefined) {
        delayMs = Math.max(delayMs, Math.min(err.retryAfterSec * 1000, 30_000));
      }
      onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs);
    }
  }
}
