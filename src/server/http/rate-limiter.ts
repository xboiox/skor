export type RateRule = { readonly limit: number; readonly windowMs: number };
export type RateDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSeconds: number };

const DEFAULT_MAX_KEYS = 50_000;

/**
 * In-memory fixed-window limiter. Fine for a single app instance (the MVP); a multi-instance
 * deployment would need a shared store such as Postgres or Redis.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxKeys: number = DEFAULT_MAX_KEYS,
  ) {}

  consume(key: string, rule: RateRule): RateDecision {
    const now = this.now();
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      if (this.windows.size >= this.maxKeys) this.sweep(now);
      this.windows.set(key, { count: 1, resetAt: now + rule.windowMs });
      return { allowed: true };
    }
    if (current.count >= rule.limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
    }
    this.windows.set(key, { count: current.count + 1, resetAt: current.resetAt });
    return { allowed: true };
  }

  size(): number {
    return this.windows.size;
  }

  private sweep(now: number): void {
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
    // Still full of live windows: drop the oldest to bound memory.
    for (const key of this.windows.keys()) {
      if (this.windows.size < this.maxKeys) break;
      this.windows.delete(key);
    }
  }
}
