import { randomInt } from "node:crypto";

/** No 0/o, 1/l/i — slugs are read aloud and typed from phones. */
export const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const SLUG_LENGTH = 6;

export function generateSlug(): string {
  return Array.from(
    { length: SLUG_LENGTH },
    () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)],
  ).join("");
}
