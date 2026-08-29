export interface RetryOptions {
  minIntervalMs: number;
  maxRetries: number;
  backoffMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const lastCall = new Map<string, number>();

export function shouldRetry(error: { status?: number; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.status === 429 || error.status === 503 || error.status === 500) return true;
  return /rate limit|too many requests|temporar/i.test(error.message ?? "");
}

export async function withRateLimit<T>(
  connectorId: string,
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const last = lastCall.get(connectorId) ?? 0;
  const wait = options.minIntervalMs - (now() - last);
  if (wait > 0) await sleep(wait);

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= options.maxRetries) {
    try {
      const result = await fn();
      lastCall.set(connectorId, now());
      return result;
    } catch (error) {
      lastError = error;
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : undefined;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === options.maxRetries || !shouldRetry({ status, message })) throw error;
      await sleep(options.backoffMs * (attempt + 1));
      attempt += 1;
    }
  }
  throw lastError;
}

export function resetRateLimitState(): void {
  lastCall.clear();
}
