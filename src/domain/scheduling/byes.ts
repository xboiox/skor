import { shuffle, type Random } from "./random";
import type { PlayerId } from "./types";

export type ByeScore = (byes: ReadonlySet<PlayerId>) => number;

export type ByeSelectionInput = {
  readonly playerIds: readonly PlayerId[];
  readonly byeCount: number;
  /** Matches played so far; the most-played sit out first (fair for late joiners too). */
  readonly playedCounts: ReadonlyMap<PlayerId, number>;
  /** Byes of the previous round; avoided by the default score. */
  readonly previousByes: ReadonlySet<PlayerId>;
  readonly random: Random;
  /**
   * Preference among equally-due players (higher is better). Only breaks ties —
   * it can never make a player who has played less sit out before one who has played more.
   */
  readonly score?: ByeScore;
};

const MAX_CANDIDATES = 256;

function binomial(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return Math.round(result);
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...tail] = items as [T, ...T[]];
  return [...combinations(tail, k - 1).map((rest) => [head, ...rest]), ...combinations(tail, k)];
}

/** Every combination when there are few, otherwise random samples. */
function candidateSets<T>(items: readonly T[], k: number, random: Random): T[][] {
  if (binomial(items.length, k) <= MAX_CANDIDATES) return combinations(items, k);
  return Array.from({ length: MAX_CANDIDATES }, () => shuffle(items, random).slice(0, k));
}

export function selectByes(input: ByeSelectionInput): PlayerId[] {
  const { playerIds, byeCount, playedCounts, previousByes, random } = input;
  if (byeCount <= 0) return [];
  if (byeCount >= playerIds.length) return [...playerIds];

  const played = (id: PlayerId) => playedCounts.get(id) ?? 0;
  const byPlayedDesc = shuffle(playerIds, random).sort((a, b) => played(b) - played(a));
  const threshold = played(byPlayedDesc[byeCount - 1]!);

  const forced = byPlayedDesc.filter((id) => played(id) > threshold);
  const tied = byPlayedDesc.filter((id) => played(id) === threshold);
  const needed = byeCount - forced.length;
  if (needed === tied.length) return [...forced, ...tied];

  const score: ByeScore =
    input.score ?? ((set) => -[...set].filter((id) => previousByes.has(id)).length);

  const candidates = [
    // Deterministic default first: those who did not sit out last round.
    [...tied]
      .sort((a, b) => Number(previousByes.has(a)) - Number(previousByes.has(b)))
      .slice(0, needed),
    ...candidateSets(tied, needed, random),
  ];

  let best = candidates[0]!;
  let bestScore = score(new Set([...forced, ...best]));
  for (const candidate of candidates.slice(1)) {
    const candidateScore = score(new Set([...forced, ...candidate]));
    if (candidateScore > bestScore) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return [...forced, ...best];
}
