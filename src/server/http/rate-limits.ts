import { AppError } from "@/lib/api-response";
import { getEnv } from "@/server/env";
import { clientIp } from "./client-ip";
import { RateLimiter, type RateRule } from "./rate-limiter";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const RATE_LIMITS = {
  /** Per player (or host) per tournament: ~2 taps a second sustained, far above real play. */
  score: { limit: 120, windowMs: MINUTE },
  /** Per tournament, for host actions (approve, players, rounds, substitutions…). */
  host: { limit: 120, windowMs: MINUTE },
  /** Per client IP: guest tournaments are free to create, so cap spam. */
  createTournament: { limit: 10, windowMs: HOUR },
  /** Shared bucket when the client IP is unknown (no trusted proxy). */
  createTournamentUnknownIp: { limit: 300, windowMs: HOUR },
  identity: { limit: 30, windowMs: MINUTE },
} as const satisfies Record<string, RateRule>;

// Survives hot reloads in development so limits are not reset on every edit.
const globalForLimiter = globalThis as unknown as { skorLimiter?: RateLimiter };
const limiter = (globalForLimiter.skorLimiter ??= new RateLimiter());

export function enforceRateLimit(key: string, rule: RateRule): void {
  const decision = limiter.consume(key, rule);
  if (!decision.allowed) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.", {
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }
}

export function requestIp(request: Request): string | null {
  const env = getEnv();
  return clientIp(request.headers, {
    trustProxy: env.TRUST_PROXY,
    header: env.CLIENT_IP_HEADER,
    trustedProxies: env.TRUSTED_PROXIES,
  });
}
