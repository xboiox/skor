import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/api-response";
import { enforceRateLimit } from "./rate-limits";

describe("enforceRateLimit", () => {
  it("throws RATE_LIMITED with a retry hint once the rule is exceeded", () => {
    const rule = { limit: 2, windowMs: 60_000 };
    const key = `test:${Math.random()}`;
    enforceRateLimit(key, rule);
    enforceRateLimit(key, rule);
    try {
      enforceRateLimit(key, rule);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({ code: "RATE_LIMITED", details: { retryAfterSeconds: 60 } });
    }
  });
});
