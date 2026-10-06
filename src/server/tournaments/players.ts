import { and, count, eq, max, sql } from "drizzle-orm";
import { AppError } from "@/lib/api-response";
import { notifyTournament } from "@/server/realtime/notify";
import { MAX_PLAYERS, playerNameSchema } from "@/lib/validation/tournament";
import type { Database, Executor } from "@/server/db/client";
import { players } from "@/server/db/schema";
import { lockDraftTournament } from "./draft";

const ROSTER_LOCKED = "Players can only be changed before the tournament starts.";

export type DraftPlayer = { readonly id: string; readonly name: string; readonly position: number };

/** Validates and normalises a player name (VALIDATION_ERROR with a user-facing message). */
export function parsePlayerName(rawName: string): string {
  const parsed = playerNameSchema.safeParse(rawName);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid name");
  }
  return parsed.data;
}

/** Names are unique per tournament regardless of case; the message names the existing player. */
export async function assertNameAvailable(
  db: Executor,
  tournamentId: string,
  name: string,
): Promise<void> {
  const [duplicate] = await db
    .select({ name: players.name })
    .from(players)
    .where(
      and(eq(players.tournamentId, tournamentId), sql`lower(${players.name}) = lower(${name})`),
    )
    .limit(1);
  if (duplicate) {
    throw new AppError("VALIDATION_ERROR", `${duplicate.name} is already in this tournament.`);
  }
}

export async function nextPosition(db: Executor, tournamentId: string): Promise<number> {
  const [row] = await db
    .select({ last: max(players.position) })
    .from(players)
    .where(eq(players.tournamentId, tournamentId));
  return (row?.last ?? -1) + 1;
}

export async function addPlayer(
  db: Database,
  tournamentId: string,
  rawName: string,
): Promise<DraftPlayer> {
  const name = parsePlayerName(rawName);

  return db.transaction(async (tx) => {
    await lockDraftTournament(tx, tournamentId, ROSTER_LOCKED);

    const [roster] = await tx
      .select({ total: count() })
      .from(players)
      .where(eq(players.tournamentId, tournamentId));
    if ((roster?.total ?? 0) >= MAX_PLAYERS) {
      throw new AppError(
        "VALIDATION_ERROR",
        `A tournament can have at most ${MAX_PLAYERS} players.`,
      );
    }
    await assertNameAvailable(tx, tournamentId, name);

    const [player] = await tx
      .insert(players)
      .values({ tournamentId, name, position: await nextPosition(tx, tournamentId) })
      .returning({ id: players.id, name: players.name, position: players.position });
    await notifyTournament(tx, { tournamentId, type: "tournament.updated" });
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
    await notifyTournament(tx, { tournamentId, type: "tournament.updated" });
  });
}
