export type PlayerId = string;

export type LeaderboardMode = "final" | "provisional";

export type MatchStatus = "scheduled" | "in_progress" | "submitted" | "approved";

export type LeaderboardPlayer = {
  readonly id: PlayerId;
  readonly name: string;
  readonly status: "active" | "withdrawn";
  /** Set for substitutes who joined after round 1. */
  readonly joinedRound: number | null;
};

export type LeaderboardMatch = {
  readonly id: string;
  readonly status: MatchStatus;
  readonly teamA: readonly [PlayerId, PlayerId];
  readonly teamB: readonly [PlayerId, PlayerId];
  readonly scoreA: number;
  readonly scoreB: number;
};

export type PlayerLabel = "withdrawn" | "substitute" | null;

export type LeaderboardRow = {
  readonly playerId: PlayerId;
  readonly name: string;
  /** Competition ranking: 1, 2, 2, 4. */
  readonly rank: number;
  readonly isSharedRank: boolean;
  readonly played: number;
  readonly pointsWon: number;
  readonly pointsLost: number;
  readonly diff: number;
  readonly avgWon: number;
  readonly label: PlayerLabel;
  /** Includes points from matches not yet approved by the host. */
  readonly isProvisional: boolean;
};

export type Leaderboard = {
  readonly rows: readonly LeaderboardRow[];
  /** True when players have played different numbers of matches, so avg points won ranks first (A7). */
  readonly usesAverage: boolean;
};
