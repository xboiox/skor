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

describe("proxy settings", () => {
  it("does not trust forwarding headers by default", () => {
    const env = parseEnv(VALID);
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.CLIENT_IP_HEADER).toBe("x-forwarded-for");
    expect(env.TRUSTED_PROXIES).toEqual([]);
  });

  it("parses TRUST_PROXY and a comma-separated proxy list", () => {
    const env = parseEnv({
      ...VALID,
      TRUST_PROXY: "true",
      TRUSTED_PROXIES: " 10.0.0.1, 172.16.0.0/12 ",
    });
    expect(env.TRUST_PROXY).toBe(true);
    expect(env.TRUSTED_PROXIES).toEqual(["10.0.0.1", "172.16.0.0/12"]);
  });

  it("rejects a TRUST_PROXY value other than true/false", () => {
    expect(() => parseEnv({ ...VALID, TRUST_PROXY: "yes" })).toThrow(/TRUST_PROXY/);
  });

  it("lower-cases the client IP header", () => {
    expect(parseEnv({ ...VALID, CLIENT_IP_HEADER: "CF-Connecting-IP" }).CLIENT_IP_HEADER).toBe(
      "cf-connecting-ip",
    );
  });
});

describe("deployment settings", () => {
  it("accepts an optional direct (unpooled) database URL", () => {
    expect(parseEnv(VALID).DATABASE_URL_UNPOOLED).toBeUndefined();
    const env = parseEnv({
      ...VALID,
      DATABASE_URL_UNPOOLED: "postgres://u:p@direct.example:5432/db",
    });
    expect(env.DATABASE_URL_UNPOOLED).toBe("postgres://u:p@direct.example:5432/db");
  });

  it("requires a CRON_SECRET of at least 16 characters when set", () => {
    expect(parseEnv(VALID).CRON_SECRET).toBeUndefined();
    expect(() => parseEnv({ ...VALID, CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
    expect(parseEnv({ ...VALID, CRON_SECRET: "c".repeat(16) }).CRON_SECRET).toHaveLength(16);
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
