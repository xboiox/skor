import { describe, expect, it } from "vitest";
import { generateSlug, SLUG_ALPHABET, SLUG_LENGTH } from "./slug";

describe("generateSlug", () => {
  it("uses 6 characters from an unambiguous alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const slug = generateSlug();
      expect(slug).toHaveLength(SLUG_LENGTH);
      expect([...slug].every((c) => SLUG_ALPHABET.includes(c))).toBe(true);
    }
  });

  it("excludes look-alike characters", () => {
    for (const c of ["0", "o", "1", "l", "i"]) expect(SLUG_ALPHABET).not.toContain(c);
  });

  it("rarely repeats", () => {
    const slugs = new Set(Array.from({ length: 2000 }, generateSlug));
    expect(slugs.size).toBeGreaterThan(1990);
  });
});
