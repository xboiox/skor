import type { ScoringInput } from "@/lib/validation/tournament";

/** Maps the scoring choice onto the tournaments columns (see the tournaments_scoring_config check). */
export function scoringColumns(scoring: ScoringInput) {
  if (scoring.type === "rally") {
    return {
      scoringType: "rally" as const,
      rallyPoints: scoring.totalPoints,
      tennisMode: null,
      tennisGames: null,
      deuceRule: null,
    };
  }
  return {
    scoringType: "tennis" as const,
    rallyPoints: null,
    tennisMode: scoring.mode,
    tennisGames: scoring.games,
    deuceRule: scoring.deuce,
  };
}
