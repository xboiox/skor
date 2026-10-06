import { asc, eq, inArray } from "drizzle-orm";
import type { PlannedRound } from "@/domain/scheduling";
import type { Executor } from "@/server/db/client";
import { matches, roundByes, rounds } from "@/server/db/schema";

/** Reads the stored schedule back into the scheduling engine's shape (actual slots, after substitutions). */
export async function loadSchedule(db: Executor, tournamentId: string): Promise<PlannedRound[]> {
  const roundRows = await db
    .select()
    .from(rounds)
    .where(eq(rounds.tournamentId, tournamentId))
    .orderBy(asc(rounds.number));
  if (roundRows.length === 0) return [];
  const roundIds = roundRows.map((r) => r.id);
  const [matchRows, byeRows] = await Promise.all([
    db.select().from(matches).where(inArray(matches.roundId, roundIds)).orderBy(asc(matches.court)),
    db.select().from(roundByes).where(inArray(roundByes.roundId, roundIds)),
  ]);
  return roundRows.map((round) => ({
    number: round.number,
    leg: round.leg as 1 | 2,
    matches: matchRows
      .filter((m) => m.roundId === round.id)
      .map((m) => ({
        court: m.court,
        teamA: [m.teamA1, m.teamA2] as const,
        teamB: [m.teamB1, m.teamB2] as const,
      })),
    byes: byeRows.filter((b) => b.roundId === round.id).map((b) => b.playerId),
  }));
}
