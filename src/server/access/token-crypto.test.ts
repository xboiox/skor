import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./token-crypto";

const SECRET = "a-secret-that-is-at-least-32-characters-long";

describe("token encryption", () => {
  it("round-trips a token", () => {
    expect(decryptToken(encryptToken("player-token-123", SECRET), SECRET)).toBe("player-token-123");
  });

  it("uses a fresh IV, so the same token encrypts differently", () => {
    expect(encryptToken("same", SECRET)).not.toBe(encryptToken("same", SECRET));
  });

  it("does not contain the plain token", () => {
    expect(encryptToken("player-token-123", SECRET)).not.toContain("player-token-123");
  });

  it("returns null with the wrong secret", () => {
    expect(
      decryptToken(encryptToken("x", SECRET), "another-secret-of-at-least-32-characters"),
    ).toBeNull();
  });

  it("returns null for tampered or malformed payloads", () => {
    const payload = encryptToken("x", SECRET);
    const tampered = payload.slice(0, -2) + (payload.endsWith("A") ? "BB" : "AA");
    expect(decryptToken(tampered, SECRET)).toBeNull();
    expect(decryptToken("garbage", SECRET)).toBeNull();
    expect(decryptToken("v2.a.b.c", SECRET)).toBeNull();
  });
});
