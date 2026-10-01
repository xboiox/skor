import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const VALID = { DATABASE_URL: "postgres://skor:skor@localhost:5432/skor" };

describe("parseEnv", () => {
  it("applies defaults for optional values", () => {
    const env = parseEnv(VALID);
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.GUEST_TTL_DAYS).toBe(7);
    expect(env.NODE_ENV).toBe("development");
  });

  it("coerces numeric strings", () => {
    expect(parseEnv({ ...VALID, GUEST_TTL_DAYS: "14" }).GUEST_TTL_DAYS).toBe(14);
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv({ ...VALID, AUTH_SECRET: "", GUEST_TTL_DAYS: "" });
    expect(env.AUTH_SECRET).toBeUndefined();
    expect(env.GUEST_TTL_DAYS).toBe(7);
  });

  it("throws a readable error when DATABASE_URL is missing", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://localhost/skor" })).toThrow(/DATABASE_URL/);
  });

  it("rejects a guest TTL outside 1-90 days", () => {
    expect(() => parseEnv({ ...VALID, GUEST_TTL_DAYS: "0" })).toThrow(/GUEST_TTL_DAYS/);
  });
});
