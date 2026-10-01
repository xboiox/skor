import { and, count, eq, max, sql } from "drizzle-orm";
import { AppError } from "@/lib/api-response";
import { MAX_PLAYERS, playerNameSchema } from "@/lib/validation/tournament";
import type { Database } from "@/server/db/client";
import { players } from "@/server/db/schema";
import { lockDraftTournament } from "./draft";

const ROSTER_LOCKED = "Players can only be changed before the tournament starts.";

export type DraftPlayer = { readonly id: string; readonly name: string; readonly position: number };

export async function addPlayer(
  db: Database,
  tournamentId: string,
  rawName: string,
): Promise<DraftPlayer> {
  const parsed = playerNameSchema.safeParse(rawName);
  if (!parsed.success)
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid name");
  const name = parsed.data;

  return db.transaction(async (tx) => {
    await lockDraftTournament(tx, tournamentId, ROSTER_LOCKED);

    const [roster] = await tx
      .select({ total: count(), lastPosition: max(players.position) })
      .from(players)
      .where(eq(players.tournamentId, tournamentId));
    if ((roster?.total ?? 0) >= MAX_PLAYERS) {
      throw new AppError(
        "VALIDATION_ERROR",
        `A tournament can have at most ${MAX_PLAYERS} players.`,
      );
    }

    const [duplicate] = await tx
      .select({ name: players.name })
      .from(players)
      .where(
        and(eq(players.tournamentId, tournamentId), sql`lower(${players.name}) = lower(${name})`),
      )
      .limit(1);
    if (duplicate)
      throw new AppError("VALIDATION_ERROR", `${duplicate.name} is already in this tournament.`);

    const [player] = await tx
      .insert(players)
      .values({ tournamentId, name, position: (roster?.lastPosition ?? -1) + 1 })
      .returning({ id: players.id, name: players.name, position: players.position });
    return player!;
  });
}

export async function removePlayer(
  db: Database,
  tournamentId: string,
  playerId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockDraftTournament(tx, tournamentId, ROSTER_LOCKED);
    const removed = await tx
      .delete(players)
      .where(and(eq(players.id, playerId), eq(players.tournamentId, tournamentId)))
      .returning({ id: players.id });
    if (removed.length === 0) throw new AppError("NOT_FOUND", "Player not found.");
  });
}
