import { describe, expect, it } from "vitest";
import { generateMexicanoFirstRound, generateMexicanoRound } from "./mexicano";
import { expectValidRound, players } from "./test-helpers";

const RANKED = players(8); // p01 is first in the standings

describe("generateMexicanoRound", () => {
  it("pairs each group of four as 1&3 vs 2&4, top group on court 1", () => {
    const result = generateMexicanoRound({
      ranking: RANKED,
      courts: 2,
      roundNumber: 3,
      playedCounts: new Map(),
      previousByes: new Set(),
      seed: 1,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        number: 3,
        leg: 1,
        byes: [],
        matches: [
          { court: 1, teamA: ["p01", "p03"], teamB: ["p02", "p04"] },
          { court: 2, teamA: ["p05", "p07"], teamB: ["p06", "p08"] },
        ],
      },
    });
  });

  it("sits out the players who have played the most and keeps ranking order for the rest", () => {
    const ranking = players(6);
    const playedCounts = new Map(ranking.map((id) => [id, id === "p02" || id === "p05" ? 3 : 2]));
    const result = generateMexicanoRound({
      ranking,
      courts: 2,
      roundNumber: 4,
      playedCounts,
      previousByes: new Set(),
      seed: 1,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect([...result.value.byes].sort()).toEqual(["p02", "p05"]);
    expect(result.value.matches).toEqual([
      { court: 1, teamA: ["p01", "p04"], teamB: ["p03", "p06"] },
    ]);
  });

  it("uses only as many courts as there are full groups", () => {
    const result = generateMexicanoRound({
      ranking: players(5),
      courts: 3,
      roundNumber: 2,
      playedCounts: new Map(),
      previousByes: new Set(),
      seed: 1,
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.matches).toHaveLength(1);
    expect(result.value.byes).toHaveLength(1);
  });

  it("validates the roster", () => {
    const base = {
      courts: 1,
      roundNumber: 2,
      playedCounts: new Map(),
      previousByes: new Set<string>(),
      seed: 1,
    };
    expect(generateMexicanoRound({ ...base, ranking: players(3) }).ok).toBe(false);
    expect(generateMexicanoRound({ ...base, ranking: ["a", "b", "c", "a"] }).ok).toBe(false);
  });

  it("rejects a round number below 1", () => {
    const result = generateMexicanoRound({
      ranking: RANKED,
      courts: 2,
      roundNumber: 0,
      playedCounts: new Map(),
      previousByes: new Set(),
      seed: 1,
    });
    expect(result.ok).toBe(false);
  });
});

describe("generateMexicanoFirstRound", () => {
  it("creates a valid random round 1", () => {
    const ids = players(10);
    const result = generateMexicanoFirstRound({ playerIds: ids, courts: 2, seed: 7 });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.number).toBe(1);
    expectValidRound(result.value, ids);
    expect(result.value.byes).toHaveLength(2);
  });

  it("is deterministic per seed and differs between seeds", () => {
    const run = (seed: number) =>
      generateMexicanoFirstRound({ playerIds: players(8), courts: 2, seed });
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });

  it("validates the roster", () => {
    expect(generateMexicanoFirstRound({ playerIds: players(2), courts: 1, seed: 1 }).ok).toBe(
      false,
    );
  });
});
