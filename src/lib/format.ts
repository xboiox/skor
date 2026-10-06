import type { ScoringConfig } from "@/domain/scoring";

type ScoringColumns = {
  scoringType: "rally" | "tennis";
  rallyPoints: number | null;
  tennisMode: "first_to" | "total_of" | null;
  tennisGames: number | null;
  deuceRule: "golden_point" | "advantage" | null;
};

export function formatScoring(t: ScoringColumns): string {
  if (t.scoringType === "rally") return `Rally points · ${t.rallyPoints} per match`;
  const games =
    t.tennisMode === "first_to"
      ? `first to ${t.tennisGames} games`
      : `${t.tennisGames} games total`;
  const deuce = t.deuceRule === "golden_point" ? "golden point" : "advantage";
  return `Tennis · ${games} · ${deuce}`;
}

export function formatMatchType(matchType: "americano" | "mexicano"): string {
  return matchType === "americano" ? "Americano" : "Mexicano";
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Tournament dates are calendar dates; format in UTC so they never shift a day. */
export function formatDate(isoDate: string): string {
  return DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Rule shown when entering a final result by hand. */
export function formatFinalHint(config: ScoringConfig): string {
  if (config.type === "rally") return `Scores must add up to ${config.totalPoints}.`;
  return config.mode === "first_to"
    ? `One team must reach ${config.games} games.`
    : `Games must add up to ${config.games}.`;
}
