import { createHash, randomBytes } from "node:crypto";

export type AccessRole = "admin" | "player";

const TOKEN_BYTES = 32;
const DAY_SECONDS = 24 * 60 * 60;
const OWNED_TOURNAMENT_COOKIE_DAYS = 180;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Tokens are stored as SHA-256 hashes; a lookup by hash reveals nothing about the token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function accessCookieName(role: AccessRole, slug: string): string {
  return `skor_${role}_${slug}`;
}

/** Which registered player this browser chose in "I am …". */
export function identityCookieName(slug: string): string {
  return `skor_me_${slug}`;
}

export type CookieOptions = {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly secure: boolean;
  readonly maxAge: number;
};

export function accessCookieOptions(input: {
  expiresAt: Date | null;
  isSecure: boolean;
  now?: Date;
}): CookieOptions {
  const now = input.now ?? new Date();
  const maxAge = input.expiresAt
    ? Math.max(0, Math.floor((input.expiresAt.getTime() - now.getTime()) / 1000))
    : OWNED_TOURNAMENT_COOKIE_DAYS * DAY_SECONDS;
  return { httpOnly: true, sameSite: "lax", path: "/", secure: input.isSecure, maxAge };
}
