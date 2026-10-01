import { describe, expect, it } from "vitest";
import { minAmericanoRounds, roundCapacity } from "./capacity";

describe("roundCapacity", () => {
  it.each([
    // players, courts → matches, playing, byes
    [8, 2, 2, 8, 0],
    [10, 2, 2, 8, 2],
    [5, 3, 1, 4, 1],
    [12, 2, 2, 8, 4],
    [7, 1, 1, 4, 3],
    [4, 1, 1, 4, 0],
    [16, 5, 4, 16, 0],
  ])(
    "%i players on %i courts → %i matches, %i playing, %i byes",
    (players, courts, matches, playing, byes) => {
      expect(roundCapacity(players, courts)).toEqual({ matches, playing, byes });
    },
  );
});

describe("minAmericanoRounds", () => {
  it.each([
    [8, 2, 7],
    [5, 1, 5],
    [12, 3, 11],
    [6, 1, 8],
    [10, 2, 12],
  ])("%i players on %i courts need at least %i rounds", (players, courts, rounds) => {
    expect(minAmericanoRounds(players, courts)).toBe(rounds);
  });
});
