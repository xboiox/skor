import { describe, expect, it } from "vitest";
import type { MatchView } from "@/server/matches/view";
import type { TournamentBoard } from "./board";
import { playerHistory, standingsOf } from "./standings";

let n = 0;
function match(
  teamA: [string, string],
  teamB: [string, string],
  scoreA: number,
  scoreB: number,
  status: MatchView["status"],
): MatchView {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    roundId: "r",
    court: 1,
    teamA,
    teamB,
    scoreA,
    scoreB,
    gameA: 0,
    gameB: 0,
    status,
    version: 1,
    display: null,
  };
}

function board(rounds: { number: number; matches: MatchView[] }[]): TournamentBoard {
  return {
    tournament: {
      id: "t",
      slug: "abc123",
      name: "T",
      date: "2026-10-03",
      matchType: "americano",
      courts: 1,
      status: "active",
      currentLeg: 1,
      scoringLabel: "Rally points · 16 per match",
    },
    scoring: { type: "rally", totalPoints: 16 },
    players: ["A", "B", "C", "D"].map((id) => ({
      id,
      name: `Player ${id}`,
      status: "active",
      joinedRound: null,
    })),
    rounds: rounds.map((r) => ({
      id: `r${r.number}`,
      number: r.number,
      leg: 1,
      status: "active",
      matches: r.matches,
      byes: [],
    })),
  };
}

describe("standingsOf", () => {
  const b = board([
    { number: 1, matches: [match(["A", "B"], ["C", "D"], 10, 6, "approved")] },
    { number: 2, matches: [match(["A", "C"], ["B", "D"], 3, 1, "in_progress")] },
  ]);

  it("final mode counts approved results only", () => {
    const { rows } = standingsOf(b, "final");
    expect(rows.find((r) => r.playerId === "A")).toMatchObject({
      played: 1,
      pointsWon: 10,
      isProvisional: false,
    });
  });

  it("live mode includes running matches and marks them provisional", () => {
    const { rows } = standingsOf(b, "provisional");
    expect(rows.find((r) => r.playerId === "A")).toMatchObject({
      played: 2,
      pointsWon: 13,
      isProvisional: true,
    });
  });

  it("uses player names from the board", () => {
    expect(standingsOf(b, "final").rows.map((r) => r.name)).toContain("Player A");
  });
});

describe("playerHistory", () => {
  it("lists a player's matches with partner, opponents and their side's score, newest first", () => {
    const b = board([
      { number: 1, matches: [match(["A", "B"], ["C", "D"], 10, 6, "approved")] },
      { number: 2, matches: [match(["C", "A"], ["B", "D"], 7, 9, "submitted")] },
      { number: 3, matches: [match(["B", "C"], ["A", "D"], 0, 0, "scheduled")] },
    ]);
    expect(playerHistory(b, "A")).toEqual([
      {
        round: 2,
        partner: "Player C",
        opponents: "Player B / Player D",
        scored: 7,
        conceded: 9,
        status: "submitted",
      },
      {
        round: 1,
        partner: "Player B",
        opponents: "Player C / Player D",
        scored: 10,
        conceded: 6,
        status: "approved",
      },
    ]);
  });
});
