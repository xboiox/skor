import { describe, expect, it } from "vitest";
import { generateAmericanoSchedule } from "./americano";
import { minAmericanoRounds } from "./capacity";
import { byeCounts, expectValidRound, partnerCounts, players } from "./test-helpers";

function schedule(playerCount: number, courts: number, seed = 1) {
  const ids = players(playerCount);
  const result = generateAmericanoSchedule({ playerIds: ids, courts, seed });
  if (!result.ok) throw new Error(result.error.message);
  return { ids, rounds: result.value };
}

const allPairs = (n: number) => (n * (n - 1)) / 2;

describe("generateAmericanoSchedule — validation", () => {
  it("needs at least 4 players", () => {
    const result = generateAmericanoSchedule({ playerIds: players(3), courts: 1, seed: 1 });
    expect(result).toEqual({
      ok: false,
      error: { code: "NOT_ENOUGH_PLAYERS", message: expect.any(String) },
    });
  });

  it("rejects duplicate player ids", () => {
    const result = generateAmericanoSchedule({
      playerIds: ["a", "b", "c", "a"],
      courts: 1,
      seed: 1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects fewer than one court", () => {
    expect(generateAmericanoSchedule({ playerIds: players(4), courts: 0, seed: 1 }).ok).toBe(false);
  });
});

describe.each([
  // players, courts, max extra rounds above the theoretical minimum
  [4, 1, 0],
  [5, 1, 0],
  [8, 2, 0],
  [12, 3, 1],
  [16, 4, 2],
  [6, 1, 2],
  [7, 1, 3],
  [9, 2, 2],
  [10, 2, 2],
  [12, 2, 2],
  [13, 3, 3],
  [20, 5, 3],
  // Many byes per round (more players than courts can hold)
  [8, 1, 1],
  [10, 1, 2],
  [12, 1, 2],
  [16, 2, 3],
  [24, 2, 8],
  [24, 3, 8],
])("%i players on %i courts", (playerCount, courts, slack) => {
  const { ids, rounds } = schedule(playerCount, courts);

  it("produces valid rounds numbered from 1 in leg 1", () => {
    rounds.forEach((round, i) => {
      expectValidRound(round, ids);
      expect(round.number).toBe(i + 1);
      expect(round.leg).toBe(1);
    });
  });

  it("partners every pair of players at least once", () => {
    expect(partnerCounts(rounds).size).toBe(allPairs(playerCount));
  });

  it(`needs at most ${slack} rounds above the minimum`, () => {
    expect(rounds.length).toBeLessThanOrEqual(minAmericanoRounds(playerCount, courts) + slack);
  });

  it("spreads byes fairly (difference ≤ 1)", () => {
    const counts = byeCounts(rounds, ids);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe("generateAmericanoSchedule — determinism", () => {
  it("returns the same schedule for the same seed", () => {
    expect(schedule(10, 2, 99).rounds).toEqual(schedule(10, 2, 99).rounds);
  });

  it("returns a different schedule for a different seed", () => {
    expect(schedule(10, 2, 1).rounds).not.toEqual(schedule(10, 2, 2).rounds);
  });
});

describe("generateAmericanoSchedule — performance", () => {
  it.each([
    [24, 6],
    [32, 8],
    [40, 10],
  ])("schedules %i players on %i courts within 2s", (playerCount, courts) => {
    const start = performance.now();
    const { rounds } = schedule(playerCount, courts);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(partnerCounts(rounds).size).toBe(allPairs(playerCount));
  });
});
