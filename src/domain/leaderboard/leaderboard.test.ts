import { describe, expect, it } from "vitest";
import { computeLeaderboard } from "./leaderboard";
import type { LeaderboardMatch, LeaderboardPlayer, MatchStatus } from "./types";

function roster(...names: string[]): LeaderboardPlayer[] {
  return names.map((name) => ({ id: name, name, status: "active", joinedRound: null }));
}

let matchId = 0;
function match(
  teamA: [string, string],
  teamB: [string, string],
  scoreA: number,
  scoreB: number,
  status: MatchStatus = "approved",
): LeaderboardMatch {
  matchId += 1;
  return { id: `m${matchId}`, status, teamA, teamB, scoreA, scoreB };
}

function standings(
  players: LeaderboardPlayer[],
  matches: LeaderboardMatch[],
  mode: "final" | "provisional" = "final",
) {
  return computeLeaderboard({ players, matches, mode });
}

const order = (board: ReturnType<typeof standings>) => board.rows.map((r) => r.playerId);
const ranks = (board: ReturnType<typeof standings>) =>
  board.rows.map((r) => `${r.playerId}:${r.rank}${r.isSharedRank ? "=" : ""}`);

describe("computeLeaderboard — stats", () => {
  it("aggregates played, points won, points lost, diff and average", () => {
    const board = standings(roster("A", "B", "C", "D"), [
      match(["A", "B"], ["C", "D"], 14, 10),
      match(["A", "C"], ["B", "D"], 9, 15),
    ]);
    expect(board.rows.find((r) => r.playerId === "A")).toMatchObject({
      played: 2,
      pointsWon: 23,
      pointsLost: 25,
      diff: -2,
      avgWon: 11.5,
    });
  });

  it("counts a draw as points won and lost for both sides (2-2 → +2 / +2)", () => {
    const board = standings(roster("A", "B", "C", "D"), [match(["A", "B"], ["C", "D"], 2, 2)]);
    for (const row of board.rows)
      expect(row).toMatchObject({ pointsWon: 2, pointsLost: 2, diff: 0 });
  });

  it("lists players who have not played yet with zeros", () => {
    const board = standings(roster("A", "B", "C", "D", "E"), [
      match(["A", "B"], ["C", "D"], 13, 11),
    ]);
    expect(board.rows.at(-1)).toMatchObject({ playerId: "E", played: 0, pointsWon: 0, avgWon: 0 });
  });

  it("credits points to whoever actually played the slot (substitutes)", () => {
    const players = [
      ...roster("A", "B", "C", "D"),
      { id: "S", name: "S", status: "active" as const, joinedRound: 2 },
    ];
    const board = standings(players, [match(["S", "B"], ["C", "D"], 16, 8)]);
    expect(board.rows.find((r) => r.playerId === "S")).toMatchObject({
      pointsWon: 16,
      label: "substitute",
    });
    expect(board.rows.find((r) => r.playerId === "A")).toMatchObject({ played: 0 });
  });

  it("does not mutate its inputs", () => {
    const players = Object.freeze(roster("A", "B", "C", "D"));
    const matches = Object.freeze([match(["A", "B"], ["C", "D"], 13, 11)]);
    computeLeaderboard({ players, matches, mode: "final" });
    expect(players.map((p) => p.id)).toEqual(["A", "B", "C", "D"]);
  });

  it("throws on a match with an unknown player", () => {
    expect(() =>
      standings(roster("A", "B", "C", "D"), [match(["A", "B"], ["C", "X"], 13, 11)]),
    ).toThrow(/Unknown player/);
  });
});

describe("computeLeaderboard — modes", () => {
  const matches = [
    match(["A", "B"], ["C", "D"], 14, 10, "approved"),
    match(["A", "C"], ["B", "D"], 3, 1, "in_progress"),
    match(["A", "D"], ["B", "C"], 20, 4, "submitted"),
    match(["B", "C"], ["A", "D"], 0, 0, "scheduled"),
  ];

  it("final mode uses approved matches only", () => {
    const row = standings(roster("A", "B", "C", "D"), matches, "final").rows.find(
      (r) => r.playerId === "A",
    );
    expect(row).toMatchObject({ played: 1, pointsWon: 14, isProvisional: false });
  });

  it("provisional mode adds live and submitted matches and flags those rows", () => {
    const board = standings(roster("A", "B", "C", "D"), matches, "provisional");
    expect(board.rows.find((r) => r.playerId === "A")).toMatchObject({
      played: 3,
      pointsWon: 37,
      isProvisional: true,
    });
  });

  it("never counts scheduled matches", () => {
    const board = standings(
      roster("A", "B", "C", "D"),
      [match(["A", "B"], ["C", "D"], 0, 0, "scheduled")],
      "provisional",
    );
    expect(board.rows.every((r) => r.played === 0)).toBe(true);
  });
});

describe("computeLeaderboard — ranking", () => {
  it("ranks by points won when everyone has played the same number of matches", () => {
    const board = standings(roster("A", "B", "C", "D"), [
      match(["A", "B"], ["C", "D"], 14, 10),
      match(["A", "C"], ["B", "D"], 9, 15),
    ]);
    expect(board.usesAverage).toBe(false);
    // B 29, D 25, A 23, C 19
    expect(order(board)).toEqual(["B", "D", "A", "C"]);
  });

  it("breaks a points-won tie by diff (tennis: games won equal, games lost differ)", () => {
    const board = standings(roster("A", "B", "C", "D", "E", "F", "G", "H"), [
      match(["A", "B"], ["C", "D"], 4, 1),
      match(["E", "F"], ["G", "H"], 4, 3),
      match(["A", "B"], ["E", "F"], 2, 4),
      match(["C", "D"], ["G", "H"], 4, 2),
    ]);
    // A/B: won 6, lost 5 (diff +1). E/F: won 8. C/D: won 5. G/H: won 5.
    const ab = board.rows.findIndex((r) => r.playerId === "A");
    const ef = board.rows.findIndex((r) => r.playerId === "E");
    expect(ef).toBeLessThan(ab);
    expect(ranks(board).slice(0, 4)).toEqual(["E:1=", "F:1=", "A:3=", "B:3="]);
    // C/D (won 5, lost 6, diff -1) above G/H (won 5, lost 8, diff -3)
    expect(order(board).slice(4)).toEqual(["C", "D", "G", "H"]);
  });

  it("switches to average points won when match counts differ (A7)", () => {
    const board = standings(roster("A", "B", "C", "D", "E"), [
      match(["A", "B"], ["C", "D"], 10, 14),
      match(["A", "C"], ["B", "E"], 10, 14),
      match(["A", "E"], ["C", "D"], 10, 14),
    ]);
    // D 28/2 = 14, C 38/3 ≈ 12.7, B 24/2 = 12, E 24/2 = 12 (B/E level, never opponents → by name), A 30/3 = 10
    expect(board.usesAverage).toBe(true);
    expect(order(board)).toEqual(["D", "C", "B", "E", "A"]);
  });

  it("in average mode, ranks a player who has not played yet last", () => {
    const board = standings(roster("A", "B", "C", "D", "E", "Z"), [
      match(["A", "B"], ["C", "D"], 0, 24),
      match(["A", "C"], ["B", "E"], 0, 24),
    ]);
    // A scored 0 in 2 matches (avg 0) — Z has not played (avg 0) but conceded nothing, so Z is above A.
    expect(board.usesAverage).toBe(true);
    expect(order(board).slice(-2)).toEqual(["Z", "A"]);
  });

  it("in average mode, breaks an equal average and diff by fewer points lost", () => {
    const board = standings(roster("A", "B", "C", "D", "E", "F", "G", "H"), [
      match(["A", "B"], ["C", "D"], 10, 10),
      match(["A", "E"], ["C", "F"], 10, 10),
      match(["G", "H"], ["E", "F"], 10, 10),
    ]);
    // Everyone averages 10 with diff 0; G/H lost 10 in 1 match, A/C lost 20 in 2.
    const lost = board.rows.map((r) => r.pointsLost);
    expect(lost).toEqual([...lost].sort((x, y) => x - y));
  });

  it("uses head-to-head when players are level on every other criterion", () => {
    const board = standings(roster("A", "B", "C", "D", "E"), [
      match(["A", "B"], ["D", "C"], 14, 10), // A beats D
      match(["D", "B"], ["C", "E"], 16, 8), // A sits out
      match(["A", "C"], ["B", "E"], 12, 12), // D sits out
    ]);
    // A and D: 26 won, 22 lost, 2 played → level; A won their meeting.
    const a = board.rows.find((r) => r.playerId === "A")!;
    const d = board.rows.find((r) => r.playerId === "D")!;
    expect([a.pointsWon, a.pointsLost, a.played]).toEqual([d.pointsWon, d.pointsLost, d.played]);
    expect(a.rank).toBeLessThan(d.rank);
    expect(a.isSharedRank).toBe(false);
  });

  it("ignores matches where the tied players were partners", () => {
    const board = standings(roster("A", "B", "C", "D"), [match(["A", "B"], ["C", "D"], 14, 10)]);
    expect(ranks(board)).toEqual(["A:1=", "B:1=", "C:3=", "D:3="]);
  });

  it("shares the rank when head-to-head is level too, ordering by name", () => {
    const board = standings(roster("D", "C", "B", "A"), [match(["A", "B"], ["C", "D"], 12, 12)]);
    expect(ranks(board)).toEqual(["A:1=", "B:1=", "C:1=", "D:1="]);
  });

  it("gives everyone rank 1 before any match is played", () => {
    const board = standings(roster("A", "B", "C", "D"), []);
    expect(board.rows.every((r) => r.rank === 1 && r.isSharedRank)).toBe(true);
    expect(board.usesAverage).toBe(false);
  });
});

describe("computeLeaderboard — labels", () => {
  it("labels withdrawn players and substitutes", () => {
    const players: LeaderboardPlayer[] = [
      ...roster("A", "B", "C"),
      { id: "W", name: "W", status: "withdrawn", joinedRound: null },
      { id: "S", name: "S", status: "active", joinedRound: 3 },
      { id: "T", name: "T", status: "withdrawn", joinedRound: 2 }, // one-off temporary substitute
    ];
    const labels = Object.fromEntries(
      standings(players, []).rows.map((r) => [r.playerId, r.label]),
    );
    expect(labels).toEqual({
      A: null,
      B: null,
      C: null,
      W: "withdrawn",
      S: "substitute",
      T: "substitute",
    });
  });
});
