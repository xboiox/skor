import { eq } from "drizzle-orm";
import type { ScoringConfig } from "@/domain/scoring";
import { AppError } from "@/lib/api-response";
import type { Transaction } from "@/server/db/client";
import { matches, scoreEvents, tournaments, type MatchSnapshot } from "@/server/db/schema";
import { scoringConfigOf } from "./scoring-config";
import { toMatchView, type MatchRow, type MatchView } from "./view";

export type Actor =
  | { readonly role: "host"; readonly userId: string | null }
  | { readonly role: "player"; readonly playerId: string };

export type LockedMatch = {
  readonly match: MatchRow;
  readonly config: ScoringConfig;
  readonly tournamentId: string;
};

type EventAction = (typeof scoreEvents.$inferInsert)["action"];

export function snapshotOf(match: MatchRow): MatchSnapshot {
  return {
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    gameA: match.gameA,
    gameB: match.gameB,
    status: match.status,
  };
}

/**
 * Locks the match row for this transaction and checks it can change: the tournament is running
 * and the caller saw the latest version (otherwise VERSION_CONFLICT carries the current state).
 */
export async function lockMatch(
  tx: Transaction,
  matchId: string,
  expectedVersion: number,
): Promise<LockedMatch> {
  const [match] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .for("update")
    .limit(1);
  if (!match) throw new AppError("NOT_FOUND", "Match not found.");

  const [tournament] = await tx
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, match.tournamentId))
    .limit(1);
  const config = scoringConfigOf(tournament!);
  if (tournament!.status !== "active")
    throw new AppError("INVALID_STATE", "This tournament is not running.");
  if (match.version !== expectedVersion) {
    throw new AppError("VERSION_CONFLICT", "The score was updated by someone else.", {
      match: toMatchView(match, config),
    });
  }
  return { match, config, tournamentId: match.tournamentId };
}

/** Writes the new state, bumps the version and records the audit event with the previous state. */
export async function saveMatch(
  tx: Transaction,
  locked: LockedMatch,
  next: MatchSnapshot & { readonly approvedAt?: Date | null },
  event: { readonly action: EventAction; readonly actor: Actor },
): Promise<MatchView> {
  const [updated] = await tx
    .update(matches)
    .set({ ...next, version: locked.match.version + 1 })
    .where(eq(matches.id, locked.match.id))
    .returning();

  await tx.insert(scoreEvents).values({
    matchId: locked.match.id,
    action: event.action,
    actorRole: event.actor.role,
    actorPlayerId: event.actor.role === "player" ? event.actor.playerId : null,
    actorUserId: event.actor.role === "host" ? event.actor.userId : null,
    prevState: snapshotOf(locked.match),
  });

  return toMatchView(updated!, locked.config);
}

export function assertNotApproved(match: MatchRow): void {
  if (match.status === "approved") {
    throw new AppError("INVALID_STATE", "This result is approved. Ask the host to change it.");
  }
}
