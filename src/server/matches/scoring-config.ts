import type { ScoringConfig } from "@/domain/scoring";
import type { tournaments } from "@/server/db/schema";

type TournamentScoring = Pick<
  typeof tournaments.$inferSelect,
  "scoringType" | "rallyPoints" | "tennisMode" | "tennisGames" | "deuceRule"
>;

/** The tournaments_scoring_config check guarantees the columns match the scoring type. */
export function scoringConfigOf(t: TournamentScoring): ScoringConfig {
  if (t.scoringType === "rally") {
    return { type: "rally", totalPoints: t.rallyPoints as 16 | 21 | 24 | 32 };
  }
  return { type: "tennis", mode: t.tennisMode!, games: t.tennisGames!, deuce: t.deuceRule! };
}
