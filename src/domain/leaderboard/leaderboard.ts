import { rankTiers, type RankEntry } from "./ranking";
import { aggregateStats, countedMatches } from "./stats";
import type {
  Leaderboard,
  LeaderboardMatch,
  LeaderboardMode,
  LeaderboardPlayer,
  LeaderboardRow,
  PlayerLabel,
} from "./types";

export type LeaderboardInput = {
  readonly players: readonly LeaderboardPlayer[];
  readonly matches: readonly LeaderboardMatch[];
  readonly mode: LeaderboardMode;
};

function labelFor(player: LeaderboardPlayer): PlayerLabel {
  if (player.joinedRound !== null) return "substitute";
  return player.status === "withdrawn" ? "withdrawn" : null;
}

export function computeLeaderboard(input: LeaderboardInput): Leaderboard {
  const matches = countedMatches(input.matches, input.mode);
  const stats = aggregateStats(
    input.players.map((p) => p.id),
    matches,
  );

  const playedCounts = new Set(
    [...stats.values()].filter((s) => s.played > 0).map((s) => s.played),
  );
  const usesAverage = playedCounts.size > 1;

  const entries: RankEntry[] = input.players.map((p) => ({
    id: p.id,
    name: p.name,
    stats: stats.get(p.id)!,
  }));
  const players = new Map(input.players.map((p) => [p.id, p]));

  let position = 1;
  const rows: LeaderboardRow[] = [];
  for (const tier of rankTiers(entries, matches, usesAverage)) {
    for (const { id, name, stats: s } of tier) {
      rows.push({
        playerId: id,
        name,
        rank: position,
        isSharedRank: tier.length > 1,
        played: s.played,
        pointsWon: s.won,
        pointsLost: s.lost,
        diff: s.won - s.lost,
        avgWon: s.played === 0 ? 0 : s.won / s.played,
        label: labelFor(players.get(id)!),
        isProvisional: s.hasProvisional,
      });
    }
    position += tier.length;
  }

  return { rows, usesAverage };
}
