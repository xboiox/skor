export type PlayerId = string;

export type Pair = readonly [PlayerId, PlayerId];

export type PlannedMatch = {
  readonly court: number;
  readonly teamA: Pair;
  readonly teamB: Pair;
};

export type Leg = 1 | 2;

export type PlannedRound = {
  readonly number: number;
  readonly leg: Leg;
  readonly matches: readonly PlannedMatch[];
  readonly byes: readonly PlayerId[];
};

export type SchedulingErrorCode = "NOT_ENOUGH_PLAYERS" | "INVALID_INPUT" | "INVALID_SUBSTITUTION";

export type SchedulingError = { readonly code: SchedulingErrorCode; readonly message: string };

export const PLAYERS_PER_MATCH = 4;
export const MIN_PLAYERS = 4;
