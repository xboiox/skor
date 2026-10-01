import type { LeaderboardMatch, LeaderboardMode, MatchStatus, PlayerId } from "./types";

export type PlayerStats = {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  readonly hasProvisional: boolean;
};

const COUNTED: Record<LeaderboardMode, ReadonlySet<MatchStatus>> = {
  final: new Set(["approved"]),
  provisional: new Set(["approved", "submitted", "in_progress"]),
};

const EMPTY: PlayerStats = { played: 0, won: 0, lost: 0, hasProvisional: false };

export function countedMatches(
  matches: readonly LeaderboardMatch[],
  mode: LeaderboardMode,
): LeaderboardMatch[] {
  return matches.filter((m) => COUNTED[mode].has(m.status));
}

/** One side of a match from a player's point of view. */
export function sideOf(match: LeaderboardMatch, playerId: PlayerId) {
  if (match.teamA.includes(playerId)) {
    return { scored: match.scoreA, conceded: match.scoreB, opponents: match.teamB };
  }
  if (match.teamB.includes(playerId)) {
    return { scored: match.scoreB, conceded: match.scoreA, opponents: match.teamA };
  }
  return null;
}

export function aggregateStats(
  playerIds: readonly PlayerId[],
  matches: readonly LeaderboardMatch[],
): ReadonlyMap<PlayerId, PlayerStats> {
  const known = new Set(playerIds);
  const stats = new Map<PlayerId, PlayerStats>(playerIds.map((id) => [id, EMPTY]));

  for (const match of matches) {
    for (const id of [...match.teamA, ...match.teamB]) {
      if (!known.has(id)) throw new Error(`Unknown player ${id} in match ${match.id}`);
      const side = sideOf(match, id)!;
      const current = stats.get(id)!;
      stats.set(id, {
        played: current.played + 1,
        won: current.won + side.scored,
        lost: current.lost + side.conceded,
        hasProvisional: current.hasProvisional || match.status !== "approved",
      });
    }
  }
  return stats;
}
