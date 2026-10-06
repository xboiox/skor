import { formatGamePoint, type GamePointDisplay, type ScoringConfig } from "@/domain/scoring";
import type { matches } from "@/server/db/schema";

export type MatchRow = typeof matches.$inferSelect;

export type MatchView = {
  readonly id: string;
  readonly roundId: string;
  readonly court: number;
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
  readonly scoreA: number;
  readonly scoreB: number;
  readonly gameA: number;
  readonly gameB: number;
  readonly status: MatchRow["status"];
  readonly version: number;
  /** Tennis only: the current game as "0/15/30/40/AD". */
  readonly display: GamePointDisplay | null;
};

export function toMatchView(row: MatchRow, config: ScoringConfig): MatchView {
  return {
    id: row.id,
    roundId: row.roundId,
    court: row.court,
    teamA: [row.teamA1, row.teamA2],
    teamB: [row.teamB1, row.teamB2],
    scoreA: row.scoreA,
    scoreB: row.scoreB,
    gameA: row.gameA,
    gameB: row.gameB,
    status: row.status,
    version: row.version,
    display:
      config.type === "tennis"
        ? formatGamePoint(config.deuce, { a: row.gameA, b: row.gameB })
        : null,
  };
}
