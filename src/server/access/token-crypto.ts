import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_CONTEXT = "skor:player-link";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(`${KEY_CONTEXT}:${secret}`).digest();
}

/**
 * AES-256-GCM so the player link can be shown again later (QR, re-sharing).
 * Format: v1.<iv>.<ciphertext>.<tag>, all base64url.
 */
export function encryptToken(token: string, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [VERSION, iv, ciphertext, cipher.getAuthTag()]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

/** Returns null when the payload is malformed, tampered with, or encrypted with another secret. */
export function decryptToken(payload: string, secret: string): string | null {
  const [version, iv, ciphertext, tag, ...rest] = payload.split(".");
  if (version !== VERSION || !iv || !ciphertext || !tag || rest.length > 0) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null; // authentication failed: wrong secret or tampered payload
  }
}
