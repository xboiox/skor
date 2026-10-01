export const RALLY_TOTAL_POINTS = [16, 21, 24, 32] as const;
export const TENNIS_GAMES_MIN = 1;
export const TENNIS_GAMES_MAX = 12;

export type RallyTotalPoints = (typeof RALLY_TOTAL_POINTS)[number];
export type TennisMode = "first_to" | "total_of";
export type DeuceRule = "golden_point" | "advantage";

export type RallyConfig = { readonly type: "rally"; readonly totalPoints: RallyTotalPoints };

export type TennisConfig = {
  readonly type: "tennis";
  readonly mode: TennisMode;
  readonly games: number;
  readonly deuce: DeuceRule;
};

export type ScoringConfig = RallyConfig | TennisConfig;

export type Team = "A" | "B";

/** scoreA/B: rally points or tennis games. gameA/B: raw points inside the current tennis game. */
export type MatchScore = {
  readonly scoreA: number;
  readonly scoreB: number;
  readonly gameA: number;
  readonly gameB: number;
};

export type LiveStatus = "in_progress" | "submitted";

export type ScoringErrorCode = "MATCH_COMPLETE" | "INVALID_FINAL_SCORE";

export type ScoringError = { readonly code: ScoringErrorCode; readonly message: string };

export const EMPTY_SCORE: MatchScore = { scoreA: 0, scoreB: 0, gameA: 0, gameB: 0 };
