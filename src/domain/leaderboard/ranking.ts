import type { PlayerStats } from "./stats";
import { sideOf } from "./stats";
import type { LeaderboardMatch, PlayerId } from "./types";

export type RankEntry = {
  readonly id: PlayerId;
  readonly name: string;
  readonly stats: PlayerStats;
};

type Comparator = (a: RankEntry, b: RankEntry) => number;

/** Exact comparison of won/played (0 when nothing played) via cross-multiplication. */
function compareAverage(a: PlayerStats, b: PlayerStats): number {
  const [aNum, aDen] = a.played === 0 ? [0, 1] : [a.won, a.played];
  const [bNum, bDen] = b.played === 0 ? [0, 1] : [b.won, b.played];
  return bNum * aDen - aNum * bDen;
}

export function primaryComparator(usesAverage: boolean): Comparator {
  const byPoints: Comparator = usesAverage
    ? (a, b) => compareAverage(a.stats, b.stats)
    : (a, b) => b.stats.won - a.stats.won;
  return (a, b) =>
    byPoints(a, b) ||
    b.stats.won - b.stats.lost - (a.stats.won - a.stats.lost) || // diff ↓
    a.stats.lost - b.stats.lost; // points lost ↑
}

const byName = (a: RankEntry, b: RankEntry) => a.name.localeCompare(b.name);

/** Splits a sorted list into runs that the comparator considers equal. */
function splitTiers(sorted: readonly RankEntry[], compare: Comparator): RankEntry[][] {
  return sorted.reduce<RankEntry[][]>((tiers, entry) => {
    const last = tiers.at(-1);
    if (last && compare(last[0]!, entry) === 0) return [...tiers.slice(0, -1), [...last, entry]];
    return [...tiers, [entry]];
  }, []);
}

/** Head-to-head among a tied group: matches won, then diff, counting only matches as opponents. */
function headToHead(
  group: readonly RankEntry[],
  matches: readonly LeaderboardMatch[],
): RankEntry[][] {
  const ids = new Set(group.map((e) => e.id));
  const record = new Map(
    group.map((entry) => {
      const meetings = matches
        .map((m) => sideOf(m, entry.id))
        .filter((side) => side !== null && side.opponents.some((o) => ids.has(o)));
      return [
        entry.id,
        {
          wins: meetings.filter((s) => s!.scored > s!.conceded).length,
          diff: meetings.reduce((sum, s) => sum + s!.scored - s!.conceded, 0),
        },
      ] as const;
    }),
  );
  const compare: Comparator = (a, b) => {
    const ra = record.get(a.id)!;
    const rb = record.get(b.id)!;
    return rb.wins - ra.wins || rb.diff - ra.diff;
  };
  const sorted = [...group].sort((a, b) => compare(a, b) || byName(a, b));
  return splitTiers(sorted, compare);
}

/** Orders players into tiers; players in the same tier share a rank. */
export function rankTiers(
  entries: readonly RankEntry[],
  matches: readonly LeaderboardMatch[],
  usesAverage: boolean,
): RankEntry[][] {
  const compare = primaryComparator(usesAverage);
  const sorted = [...entries].sort((a, b) => compare(a, b) || byName(a, b));
  return splitTiers(sorted, compare).flatMap((tier) =>
    tier.length > 1 ? headToHead(tier, matches) : [tier],
  );
}
