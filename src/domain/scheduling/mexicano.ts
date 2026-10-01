import { failure, success, type Result } from "../result";
import { selectByes } from "./byes";
import { roundCapacity } from "./capacity";
import { createRandom, shuffle } from "./random";
import {
  PLAYERS_PER_MATCH,
  type PlannedMatch,
  type PlannedRound,
  type PlayerId,
  type SchedulingError,
} from "./types";
import { validateRoster } from "./validate";

export type MexicanoRoundInput = {
  /** Active players in leaderboard order, best first. */
  readonly ranking: readonly PlayerId[];
  readonly courts: number;
  readonly roundNumber: number;
  readonly playedCounts: ReadonlyMap<PlayerId, number>;
  readonly previousByes: ReadonlySet<PlayerId>;
  readonly seed: number;
};

export type MexicanoFirstRoundInput = {
  readonly playerIds: readonly PlayerId[];
  readonly courts: number;
  readonly seed: number;
};

/** Groups of four by standing: [r1, r2, r3, r4] → r1 & r3 vs r2 & r4, top group on court 1. */
export function generateMexicanoRound(
  input: MexicanoRoundInput,
): Result<PlannedRound, SchedulingError> {
  const valid = validateRoster(input.ranking, input.courts);
  if (!valid.ok) return valid;
  if (!Number.isInteger(input.roundNumber) || input.roundNumber < 1) {
    return failure({ code: "INVALID_INPUT", message: "Round number must be 1 or higher." });
  }

  const capacity = roundCapacity(input.ranking.length, input.courts);
  const byes = selectByes({
    playerIds: input.ranking,
    byeCount: capacity.byes,
    playedCounts: input.playedCounts,
    previousByes: input.previousByes,
    random: createRandom(input.seed),
  });
  const byeSet = new Set(byes);
  const active = input.ranking.filter((id) => !byeSet.has(id));

  const matches: PlannedMatch[] = Array.from({ length: capacity.matches }, (_, i) => {
    const [r1, r2, r3, r4] = active.slice(i * PLAYERS_PER_MATCH, (i + 1) * PLAYERS_PER_MATCH) as [
      PlayerId,
      PlayerId,
      PlayerId,
      PlayerId,
    ];
    return { court: i + 1, teamA: [r1, r3], teamB: [r2, r4] };
  });

  return success({ number: input.roundNumber, leg: 1, matches, byes });
}

/** Round 1 has no standings yet, so the order is random (A5). */
export function generateMexicanoFirstRound(
  input: MexicanoFirstRoundInput,
): Result<PlannedRound, SchedulingError> {
  const valid = validateRoster(input.playerIds, input.courts);
  if (!valid.ok) return valid;
  return generateMexicanoRound({
    ranking: shuffle(input.playerIds, createRandom(input.seed)),
    courts: input.courts,
    roundNumber: 1,
    playedCounts: new Map(),
    previousByes: new Set(),
    seed: input.seed,
  });
}
