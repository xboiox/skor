import { describe, expect, it } from "vitest";
import { isGoogleAuthEnabled, parseEnv } from "./env";

const VALID = {
  DATABASE_URL: "postgres://skor:skor@localhost:5432/skor",
  AUTH_SECRET: "x".repeat(32),
};

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
    const env = parseEnv({ ...VALID, AUTH_GOOGLE_ID: "", GUEST_TTL_DAYS: "" });
    expect(env.AUTH_GOOGLE_ID).toBeUndefined();
    expect(env.GUEST_TTL_DAYS).toBe(7);
  });

  it("requires an AUTH_SECRET of at least 32 characters", () => {
    expect(() => parseEnv({ ...VALID, AUTH_SECRET: "" })).toThrow(/AUTH_SECRET/);
    expect(() => parseEnv({ ...VALID, AUTH_SECRET: "short" })).toThrow(/AUTH_SECRET/);
  });

  it("accepts Google credentials as a pair", () => {
    const env = parseEnv({ ...VALID, AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" });
    expect([env.AUTH_GOOGLE_ID, env.AUTH_GOOGLE_SECRET]).toEqual(["id", "secret"]);
  });

  it("rejects only one half of the Google credentials", () => {
    expect(() => parseEnv({ ...VALID, AUTH_GOOGLE_ID: "id" })).toThrow(/AUTH_GOOGLE_SECRET/);
    expect(() => parseEnv({ ...VALID, AUTH_GOOGLE_SECRET: "secret" })).toThrow(/AUTH_GOOGLE_ID/);
  });

  it("throws a readable error when DATABASE_URL is missing", () => {
    expect(() => parseEnv({ AUTH_SECRET: VALID.AUTH_SECRET })).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() => parseEnv({ ...VALID, DATABASE_URL: "mysql://localhost/skor" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a guest TTL outside 1-90 days", () => {
    expect(() => parseEnv({ ...VALID, GUEST_TTL_DAYS: "0" })).toThrow(/GUEST_TTL_DAYS/);
  });
});

describe("isGoogleAuthEnabled", () => {
  it("is true only when both Google credentials are set", () => {
    expect(isGoogleAuthEnabled(parseEnv(VALID))).toBe(false);
    expect(
      isGoogleAuthEnabled(parseEnv({ ...VALID, AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" })),
    ).toBe(true);
  });
});
