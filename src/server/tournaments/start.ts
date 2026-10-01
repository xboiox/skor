import { and, asc, eq } from "drizzle-orm";
import {
  generateAmericanoSchedule,
  generateMexicanoFirstRound,
  type PlannedRound,
  type SchedulingError,
} from "@/domain/scheduling";
import type { Result } from "@/domain/result";
import { AppError } from "@/lib/api-response";
import type { Database } from "@/server/db/client";
import { players, tournaments } from "@/server/db/schema";
import { lockDraftTournament } from "./draft";
import { saveRounds } from "./schedule-store";

const FIRST_ROUND = 1;

/**
 * Generates the schedule and moves the tournament from draft to active.
 * Americano gets every round now; Mexicano only round 1 (later rounds depend on standings).
 */
export async function startTournament(db: Database, tournamentId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const tournament = await lockDraftTournament(
      tx,
      tournamentId,
      "This tournament has already started.",
    );

    const roster = await tx
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.tournamentId, tournamentId), eq(players.status, "active")))
      .orderBy(asc(players.position));
    const playerIds = roster.map((p) => p.id);
    const input = { playerIds, courts: tournament.courts, seed: tournament.rngSeed };

    const planned: Result<PlannedRound[], SchedulingError> =
      tournament.matchType === "americano"
        ? generateAmericanoSchedule(input)
        : mapRound(generateMexicanoFirstRound(input));
    if (!planned.ok) throw new AppError("VALIDATION_ERROR", planned.error.message);

    await saveRounds(tx, tournamentId, planned.value, FIRST_ROUND);
    await tx.update(tournaments).set({ status: "active" }).where(eq(tournaments.id, tournamentId));
  });
}

function mapRound(
  result: Result<PlannedRound, SchedulingError>,
): Result<PlannedRound[], SchedulingError> {
  return result.ok ? { ok: true, value: [result.value] } : result;
}
