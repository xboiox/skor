import { eq } from "drizzle-orm";
import { AppError } from "@/lib/api-response";
import type { Database } from "@/server/db/client";
import { matches, tournaments } from "@/server/db/schema";
import { scoringConfigOf } from "./scoring-config";
import { toMatchView, type MatchView } from "./view";

export async function getMatchView(db: Database, matchId: string): Promise<MatchView> {
  const [row] = await db
    .select({ match: matches, tournament: tournaments })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Match not found.");
  return toMatchView(row.match, scoringConfigOf(row.tournament));
}
