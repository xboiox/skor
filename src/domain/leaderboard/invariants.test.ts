import { describe, expect, it } from "vitest";
import { generateAmericanoSchedule } from "../scheduling/americano";
import { createRandom, shuffle } from "../scheduling/random";
import { players } from "../scheduling/test-helpers";
import { computeLeaderboard } from "./leaderboard";
import type { LeaderboardMatch, LeaderboardPlayer, LeaderboardRow } from "./types";

const RALLY_TOTAL = 24;

/** A real Americano schedule with random rally results (draws included). */
function randomTournament(playerCount: number, courts: number, seed: number) {
  const ids = players(playerCount);
  const schedule = generateAmericanoSchedule({ playerIds: ids, courts, seed });
  if (!schedule.ok) throw new Error(schedule.error.message);
  const random = createRandom(seed);
  const matches: LeaderboardMatch[] = schedule.value.flatMap((round) =>
    round.matches.map((m, i) => {
      const scoreA = Math.floor(random() * (RALLY_TOTAL + 1));
      return {
        id: `r${round.number}c${i}`,
        status: random() < 0.8 ? "approved" : "submitted",
        teamA: m.teamA,
        teamB: m.teamB,
        scoreA,
        scoreB: RALLY_TOTAL - scoreA,
      };
    }),
  );
  const roster: LeaderboardPlayer[] = ids.map((id) => ({
    id,
    name: id,
    status: "active",
    joinedRound: null,
  }));
  return { roster, matches };
}

function expectConsistentRanks(rows: readonly LeaderboardRow[]) {
  expect(rows[0]?.rank).toBe(1);
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    if (!prev) return;
    expect(row.rank).toBeGreaterThanOrEqual(prev.rank);
    if (row.rank === prev.rank) expect(row.isSharedRank && prev.isSharedRank).toBe(true);
    else expect(row.rank).toBe(i + 1); // competition ranking skips shared places
  });
}

describe.each([
  [8, 2, 1],
  [10, 2, 2],
  [13, 3, 3],
  [16, 4, 4],
])("leaderboard invariants: %i players / %i courts (seed %i)", (playerCount, courts, seed) => {
  const { roster, matches } = randomTournament(playerCount, courts, seed);

  it.each(["final", "provisional"] as const)(
    "%s: points won and lost balance across players",
    (mode) => {
      const { rows } = computeLeaderboard({ players: roster, matches, mode });
      const won = rows.reduce((sum, r) => sum + r.pointsWon, 0);
      const lost = rows.reduce((sum, r) => sum + r.pointsLost, 0);
      expect(won).toBe(lost);
      expect(rows.reduce((sum, r) => sum + r.diff, 0)).toBe(0);
    },
  );

  it.each(["final", "provisional"] as const)("%s: ranks are consistent", (mode) => {
    expectConsistentRanks(computeLeaderboard({ players: roster, matches, mode }).rows);
  });

  it("does not depend on the order of players or matches", () => {
    const random = createRandom(seed + 100);
    const base = computeLeaderboard({ players: roster, matches, mode: "provisional" });
    const shuffled = computeLeaderboard({
      players: shuffle(roster, random),
      matches: shuffle(matches, random),
      mode: "provisional",
    });
    expect(shuffled).toEqual(base);
  });
});
