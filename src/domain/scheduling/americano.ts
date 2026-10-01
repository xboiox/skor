import { success, type Result } from "../result";
import { selectByes, type ByeScore } from "./byes";
import { minAmericanoRounds, roundCapacity } from "./capacity";
import { minCostPerfectMatching } from "./matching";
import { PairCounter } from "./pair-counter";
import { createRandom, deriveSeed, type Random } from "./random";
import type { Pair, PlannedMatch, PlannedRound, PlayerId, SchedulingError } from "./types";
import { validateRoster } from "./validate";

export type AmericanoInput = {
  readonly playerIds: readonly PlayerId[];
  readonly courts: number;
  readonly seed: number;
};

const MAX_ATTEMPTS = 24;
const MIN_ATTEMPTS = 2;
/** Caps total work: fewer attempts when every schedule is long (many byes). */
const ROUND_BUDGET = 400;
const TEAM_SEARCH_BUDGET = 3_000;
const MATCHUP_SEARCH_BUDGET = 1_000;

type Candidate = {
  readonly rounds: readonly PlannedRound[];
  readonly uncoveredPairs: number;
  readonly opponentSpread: number;
};

/**
 * Builds a full Americano schedule in which every pair of players partners at least once.
 * Several complete schedules are built from derived seeds and the best one is kept.
 */
export function generateAmericanoSchedule(
  input: AmericanoInput,
): Result<PlannedRound[], SchedulingError> {
  const valid = validateRoster(input.playerIds, input.courts);
  if (!valid.ok) return valid;

  const target = minAmericanoRounds(input.playerIds.length, input.courts);
  let best: Candidate | null = null;

  const attempts = Math.max(
    MIN_ATTEMPTS,
    Math.min(MAX_ATTEMPTS, Math.floor(ROUND_BUDGET / target)),
  );
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const random = createRandom(deriveSeed(input.seed, attempt));
    const candidate = buildSchedule(input.playerIds, input.courts, target, random);
    if (!best || isBetter(candidate, best)) best = candidate;
    if (best.uncoveredPairs === 0 && best.rounds.length <= target) break;
  }

  return success([...best!.rounds]);
}

function isBetter(a: Candidate, b: Candidate): boolean {
  if (a.uncoveredPairs !== b.uncoveredPairs) return a.uncoveredPairs < b.uncoveredPairs;
  if (a.rounds.length !== b.rounds.length) return a.rounds.length < b.rounds.length;
  return a.opponentSpread < b.opponentSpread;
}

function buildSchedule(
  playerIds: readonly PlayerId[],
  courts: number,
  target: number,
  random: Random,
): Candidate {
  const n = playerIds.length;
  const capacity = roundCapacity(n, courts);
  const maxRounds = target * 2 + 4;
  const partners = new PairCounter(playerIds);
  const opponents = new PairCounter(playerIds);
  const played = new Map<PlayerId, number>();
  let uncoveredPairs = (n * (n - 1)) / 2;
  let previousByes = new Set<PlayerId>();
  const rounds: PlannedRound[] = [];

  while (uncoveredPairs > 0 && rounds.length < maxRounds) {
    const byes = selectByes({
      playerIds,
      byeCount: capacity.byes,
      playedCounts: played,
      previousByes,
      random,
      score: coverageScore(playerIds, partners, previousByes),
    });
    const byeSet = new Set(byes);
    const active = playerIds.filter((id) => !byeSet.has(id));

    const teams = minCostPerfectMatching(
      active,
      (a, b) => partners.get(a, b),
      random,
      TEAM_SEARCH_BUDGET,
    );
    const matchups = minCostPerfectMatching(
      teams,
      (x, y) => opponentCost(opponents, x, y),
      random,
      MATCHUP_SEARCH_BUDGET,
    );

    const matches: PlannedMatch[] = matchups.map(([teamA, teamB], i) => ({
      court: i + 1,
      teamA,
      teamB,
    }));
    for (const { teamA, teamB } of matches) {
      for (const [a, b] of [teamA, teamB]) {
        if (partners.add(a, b) === 1) uncoveredPairs -= 1;
      }
      for (const a of teamA) for (const b of teamB) opponents.add(a, b);
      for (const id of [...teamA, ...teamB]) played.set(id, (played.get(id) ?? 0) + 1);
    }

    rounds.push({ number: rounds.length + 1, leg: 1, matches, byes });
    previousByes = byeSet;
  }

  return { rounds, uncoveredPairs, opponentSpread: opponents.spread() };
}

const BACK_TO_BACK_PENALTY = 0.5;

/**
 * Prefers bye sets that leave the most not-yet-partnered pairs among the players on court:
 * uncovered(active) = uncovered(all) − Σ uncoveredDegree(bye) + uncovered(within byes).
 * Back-to-back byes are a soft penalty only, so two halves never lock into alternating.
 */
function coverageScore(
  playerIds: readonly PlayerId[],
  partners: PairCounter,
  previousByes: ReadonlySet<PlayerId>,
): ByeScore {
  const degree = new Map<PlayerId, number>(
    playerIds.map((a) => [a, playerIds.filter((b) => b !== a && partners.get(a, b) === 0).length]),
  );
  return (byes) => {
    const list = [...byes];
    let lost = 0;
    for (const id of list) lost += degree.get(id) ?? 0;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (partners.get(list[i]!, list[j]!) === 0) lost -= 1;
      }
    }
    const backToBack = list.filter((id) => previousByes.has(id)).length;
    return -lost - backToBack * BACK_TO_BACK_PENALTY;
  };
}

function opponentCost(opponents: PairCounter, x: Pair, y: Pair): number {
  return x.reduce((sum, a) => sum + y.reduce((s, b) => s + opponents.get(a, b), 0), 0);
}
