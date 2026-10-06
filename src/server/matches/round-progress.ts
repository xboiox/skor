import { and, asc, eq, ne } from "drizzle-orm";
import type { Transaction } from "@/server/db/client";
import { matches, rounds } from "@/server/db/schema";
import { notifyTournament } from "@/server/realtime/notify";

/**
 * Marks a round completed once every match is approved, then activates the next pending round
 * if none is active. Round status is progress information; it does not block scoring.
 */
export async function refreshRoundProgress(
  tx: Transaction,
  tournamentId: string,
  roundId: string,
): Promise<void> {
  const [open] = await tx
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.roundId, roundId), ne(matches.status, "approved")))
    .limit(1);
  if (open) return;

  await tx.update(rounds).set({ status: "completed" }).where(eq(rounds.id, roundId));
  await notifyTournament(tx, { tournamentId, type: "tournament.updated" });

  const [active] = await tx
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.status, "active")))
    .limit(1);
  if (active) return;

  const [next] = await tx
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.status, "pending")))
    .orderBy(asc(rounds.number))
    .limit(1);
  if (next) await tx.update(rounds).set({ status: "active" }).where(eq(rounds.id, next.id));
}
