import { describe, expect, it } from "vitest";
import { byeCandidates, roundOptions } from "./replace-options";

const match = (id: string, round: number, status: string, players: string[]) => ({
  id,
  round,
  status,
  players,
});
const ROUNDS = [
  {
    number: 1,
    status: "completed",
    matches: [match("m1", 1, "approved", ["a", "b", "c", "d"])],
    byes: ["e"],
  },
  {
    number: 2,
    status: "active",
    matches: [match("m2", 2, "in_progress", ["a", "c", "e", "b"])],
    byes: ["d"],
  },
  {
    number: 3,
    status: "pending",
    matches: [match("m3", 3, "scheduled", ["a", "e", "c", "d"])],
    byes: ["b"],
  },
];

describe("roundOptions", () => {
  it("temporary: only rounds where the player has a match that has not started", () => {
    expect(
      roundOptions({ rounds: ROUNDS, outPlayerId: "a", type: "temporary", matchType: "americano" }),
    ).toEqual([3]);
    expect(
      roundOptions({ rounds: ROUNDS, outPlayerId: "b", type: "temporary", matchType: "americano" }),
    ).toEqual([]);
  });

  it("permanent: every round that is not complete", () => {
    expect(
      roundOptions({ rounds: ROUNDS, outPlayerId: "a", type: "permanent", matchType: "americano" }),
    ).toEqual([2, 3]);
  });

  it("permanent Mexicano: also the next round that does not exist yet", () => {
    expect(
      roundOptions({ rounds: ROUNDS, outPlayerId: "a", type: "permanent", matchType: "mexicano" }),
    ).toEqual([2, 3, 4]);
  });
});

describe("byeCandidates", () => {
  it("lists active players sitting out that round", () => {
    const players = [
      { id: "b", name: "Budi", status: "active" as const },
      { id: "d", name: "Dewi", status: "withdrawn" as const },
    ];
    expect(byeCandidates(ROUNDS, 3, players)).toEqual([{ id: "b", name: "Budi" }]);
    expect(byeCandidates(ROUNDS, 2, players)).toEqual([]);
  });
});
