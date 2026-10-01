import { eq } from "drizzle-orm";
import { AppError } from "@/lib/api-response";
import type { Transaction } from "@/server/db/client";
import { tournaments } from "@/server/db/schema";

/** Locks the tournament row for the rest of the transaction and checks it is still a draft. */
export async function lockDraftTournament(tx: Transaction, tournamentId: string, message: string) {
  const [tournament] = await tx
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .for("update")
    .limit(1);
  if (!tournament) throw new AppError("NOT_FOUND", "Tournament not found.");
  if (tournament.status !== "draft") throw new AppError("INVALID_STATE", message);
  return tournament;
}
