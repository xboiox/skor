import { describe, expect, it } from "vitest";
import {
  accessCookieName,
  accessCookieOptions,
  generateToken,
  hashToken,
  identityCookieName,
} from "./tokens";

describe("generateToken", () => {
  it("returns 32 random bytes as base64url", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateToken));
    expect(tokens.size).toBe(200);
  });
});

describe("hashToken", () => {
  it("is a deterministic SHA-256 hex digest", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abd")).not.toBe(hashToken("abc"));
  });
});

describe("cookie names", () => {
  it("are scoped per tournament and role", () => {
    expect(accessCookieName("admin", "k7p2xq")).toBe("skor_admin_k7p2xq");
    expect(accessCookieName("player", "k7p2xq")).toBe("skor_player_k7p2xq");
    expect(identityCookieName("k7p2xq")).toBe("skor_me_k7p2xq");
  });
});

describe("accessCookieOptions", () => {
  const now = new Date("2026-10-01T10:00:00Z");

  it("is httpOnly, lax and site-wide", () => {
    expect(accessCookieOptions({ expiresAt: null, isSecure: false, now })).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
    });
  });

  it("expires together with a guest tournament", () => {
    const expiresAt = new Date("2026-10-08T10:00:00Z");
    expect(accessCookieOptions({ expiresAt, isSecure: true, now }).maxAge).toBe(7 * 24 * 60 * 60);
  });

  it("lasts 180 days for tournaments owned by an account", () => {
    expect(accessCookieOptions({ expiresAt: null, isSecure: true, now }).maxAge).toBe(
      180 * 24 * 60 * 60,
    );
  });

  it("never returns a negative max age", () => {
    const past = new Date("2026-09-01T00:00:00Z");
    expect(accessCookieOptions({ expiresAt: past, isSecure: true, now }).maxAge).toBe(0);
  });
});
