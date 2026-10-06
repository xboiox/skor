import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limiter";

function clock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe("RateLimiter", () => {
  const rule = { limit: 3, windowMs: 1000 };

  it("allows up to the limit within a window", () => {
    const limiter = new RateLimiter(clock().now);
    expect([1, 2, 3].map(() => limiter.consume("k", rule).allowed)).toEqual([true, true, true]);
    expect(limiter.consume("k", rule)).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it("starts a fresh window after it expires", () => {
    const c = clock();
    const limiter = new RateLimiter(c.now);
    for (let i = 0; i < 3; i += 1) limiter.consume("k", rule);
    c.advance(1000);
    expect(limiter.consume("k", rule).allowed).toBe(true);
  });

  it("keeps keys independent", () => {
    const limiter = new RateLimiter(clock().now);
    for (let i = 0; i < 3; i += 1) limiter.consume("a", rule);
    expect(limiter.consume("b", rule).allowed).toBe(true);
  });

  it("reports the seconds left until the window resets", () => {
    const c = clock();
    const limiter = new RateLimiter(c.now);
    const slow = { limit: 1, windowMs: 60_000 };
    limiter.consume("k", slow);
    c.advance(15_500);
    expect(limiter.consume("k", slow)).toEqual({ allowed: false, retryAfterSeconds: 45 });
  });

  it("forgets expired windows so memory stays bounded", () => {
    const c = clock();
    const limiter = new RateLimiter(c.now, 10);
    for (let i = 0; i < 50; i += 1) limiter.consume(`k${i}`, rule);
    c.advance(2000);
    limiter.consume("fresh", rule);
    expect(limiter.size()).toBeLessThanOrEqual(10);
  });
});
