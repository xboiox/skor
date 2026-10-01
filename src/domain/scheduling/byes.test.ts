import { describe, expect, it } from "vitest";
import { selectByes } from "./byes";
import { createRandom } from "./random";

const PLAYERS = ["a", "b", "c", "d", "e", "f"];
const noHistory = { playedCounts: new Map<string, number>(), previousByes: new Set<string>() };

describe("selectByes", () => {
  it("returns no byes when the count is zero", () => {
    expect(
      selectByes({ playerIds: PLAYERS, byeCount: 0, ...noHistory, random: createRandom(1) }),
    ).toEqual([]);
  });

  it("returns everyone when the bye count covers all players", () => {
    expect(
      selectByes({ playerIds: ["a", "b"], byeCount: 5, ...noHistory, random: createRandom(1) }),
    ).toEqual(["a", "b"]);
  });

  it("sits out the players who have played the most", () => {
    const playedCounts = new Map([
      ["a", 3],
      ["b", 2],
      ["c", 3],
      ["d", 2],
      ["e", 2],
      ["f", 2],
    ]);
    const byes = selectByes({
      playerIds: PLAYERS,
      byeCount: 2,
      playedCounts,
      previousByes: new Set(),
      random: createRandom(1),
    });
    expect([...byes].sort()).toEqual(["a", "c"]);
  });

  it("avoids back-to-back byes when others are equally due", () => {
    const byes = selectByes({
      playerIds: PLAYERS,
      byeCount: 2,
      playedCounts: new Map(),
      previousByes: new Set(["a", "b", "c", "d"]),
      random: createRandom(1),
    });
    expect([...byes].sort()).toEqual(["e", "f"]);
  });

  it("lets a late joiner (fewer matches played) play first", () => {
    const playedCounts = new Map([
      ["a", 4],
      ["b", 4],
      ["c", 4],
      ["d", 4],
      ["new", 0],
    ]);
    const byes = selectByes({
      playerIds: ["a", "b", "c", "d", "new"],
      byeCount: 1,
      playedCounts,
      previousByes: new Set(),
      random: createRandom(5),
    });
    expect(byes).not.toContain("new");
  });

  it("breaks ties deterministically with the seed", () => {
    const run = (seed: number) =>
      selectByes({ playerIds: PLAYERS, byeCount: 2, ...noHistory, random: createRandom(seed) });
    expect(run(11)).toEqual(run(11));
  });

  it("uses the preference score to choose among equally-due players", () => {
    // Everyone has played the same; the score prefers sitting out "e" and "f".
    const byes = selectByes({
      playerIds: PLAYERS,
      byeCount: 2,
      ...noHistory,
      random: createRandom(1),
      score: (set) => (set.has("e") ? 1 : 0) + (set.has("f") ? 1 : 0),
    });
    expect([...byes].sort()).toEqual(["e", "f"]);
  });

  it("never lets the preference score override fairness", () => {
    const playedCounts = new Map([
      ["a", 5],
      ["b", 4],
      ["c", 4],
      ["d", 4],
    ]);
    const byes = selectByes({
      playerIds: ["a", "b", "c", "d"],
      byeCount: 1,
      playedCounts,
      previousByes: new Set(),
      random: createRandom(1),
      score: (set) => (set.has("b") ? 100 : 0),
    });
    expect(byes).toEqual(["a"]);
  });
});
