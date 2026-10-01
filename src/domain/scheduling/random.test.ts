import { describe, expect, it } from "vitest";
import { createRandom, deriveSeed, shuffle } from "./random";

describe("createRandom", () => {
  it("is deterministic for the same seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("differs between seeds", () => {
    expect(createRandom(1)()).not.toBe(createRandom(2)());
  });

  it("returns values in [0, 1)", () => {
    const random = createRandom(7);
    const values = Array.from({ length: 1000 }, () => random());
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });
});

describe("deriveSeed", () => {
  it("produces distinct seeds per attempt", () => {
    const seeds = new Set(Array.from({ length: 50 }, (_, i) => deriveSeed(123, i)));
    expect(seeds.size).toBe(50);
  });
});

describe("shuffle", () => {
  it("returns a permutation without mutating the input", () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6]);
    const result = shuffle(input, createRandom(9));
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("is deterministic for the same seed", () => {
    expect(shuffle([1, 2, 3, 4, 5], createRandom(3))).toEqual(
      shuffle([1, 2, 3, 4, 5], createRandom(3)),
    );
  });
});
