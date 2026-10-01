import { describe, expect, it } from "vitest";
import { minCostPerfectMatching } from "./matching";
import { createRandom } from "./random";

const ITEMS = ["a", "b", "c", "d", "e", "f"];

function totalCost(
  pairs: readonly (readonly [string, string])[],
  cost: (x: string, y: string) => number,
) {
  return pairs.reduce((sum, [x, y]) => sum + cost(x, y), 0);
}

describe("minCostPerfectMatching", () => {
  it("pairs every item exactly once", () => {
    const pairs = minCostPerfectMatching(ITEMS, () => 1, createRandom(1));
    expect(pairs).toHaveLength(3);
    expect(pairs.flat().sort()).toEqual(ITEMS);
  });

  it("finds the zero-cost matching when one exists", () => {
    // Only a-b, c-d, e-f are free; everything else is expensive.
    const free = new Set(["a|b", "c|d", "e|f"]);
    const cost = (x: string, y: string) => (free.has([x, y].sort().join("|")) ? 0 : 10);
    const pairs = minCostPerfectMatching(ITEMS, cost, createRandom(3));
    expect(totalCost(pairs, cost)).toBe(0);
  });

  it("finds the minimum when no zero-cost matching exists", () => {
    const weights: Record<string, number> = { "a|b": 1, "c|d": 1, "e|f": 5, "a|e": 2, "b|f": 2 };
    const cost = (x: string, y: string) => weights[[x, y].sort().join("|")] ?? 9;
    const pairs = minCostPerfectMatching(ITEMS, cost, createRandom(4));
    // Best: a-e(2) + b-f(2) + c-d(1) = 5, beats a-b + c-d + e-f = 7.
    expect(totalCost(pairs, cost)).toBe(5);
  });

  it("returns an empty list for no items", () => {
    expect(minCostPerfectMatching([], () => 0, createRandom(1))).toEqual([]);
  });

  it("rejects an odd number of items", () => {
    expect(() => minCostPerfectMatching(["a", "b", "c"], () => 0, createRandom(1))).toThrow(/even/);
  });

  it("still returns a full matching when the search budget runs out", () => {
    const many = Array.from({ length: 40 }, (_, i) => `p${i}`);
    const pairs = minCostPerfectMatching(
      many,
      (x, y) => (x.length + y.length) % 3,
      createRandom(2),
      10,
    );
    expect(pairs.flat().sort()).toEqual([...many].sort());
  });
});
