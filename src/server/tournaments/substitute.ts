import { and, eq, inArray } from "drizzle-orm";
import { planSubstitution, type ScheduledMatch, type SubstitutionPlan } from "@/domain/scheduling";
import { AppError } from "@/lib/api-response";
import { notifyTournament } from "@/server/realtime/notify";
import type { Database, Transaction } from "@/server/db/client";
import {
  matches,
  players,
  roundByes,
  rounds,
  substitutions,
  tournaments,
} from "@/server/db/schema";
import { assertNameAvailable, nextPosition, parsePlayerName } from "./players";

export type SubstitutionRequest = {
  readonly type: "temporary" | "permanent";
  readonly fromRound: number;
  readonly outPlayerId: string;
  readonly substitute:
    | { readonly source: "new_player"; readonly name: string }
    | { readonly source: "bye_player"; readonly playerId: string };
};

export type SubstitutionResult = {
  readonly inPlayer: { readonly id: string | null; readonly name: string };
  /** Matches whose slot changes, as round/court for display. */
  readonly affected: readonly { readonly round: number; readonly court: number }[];
};

const PREVIEW_PLAYER_ID = "preview-new-player";

async function loadState(tx: Transaction, tournamentId: string) {
  const [roster, roundRows, matchRows] = await Promise.all([
    tx.select().from(players).where(eq(players.tournamentId, tournamentId)),
    tx.select().from(rounds).where(eq(rounds.tournamentId, tournamentId)),
    tx.select().from(matches).where(eq(matches.tournamentId, tournamentId)),
  ]);
  const roundNumber = new Map(roundRows.map((r) => [r.id, r.number]));
  const roundId = new Map(roundRows.map((r) => [r.number, r.id]));
  const byeRows = roundRows.length
    ? await tx
        .select()
        .from(roundByes)
        .where(
          inArray(
            roundByes.roundId,
            roundRows.map((r) => r.id),
          ),
        )
    : [];
  const schedule: ScheduledMatch[] = matchRows.map((m) => ({
    id: m.id,
    roundNumber: roundNumber.get(m.roundId)!,
    status: m.status,
    teamA: [m.teamA1, m.teamA2],
    teamB: [m.teamB1, m.teamB2],
  }));
  const byes = roundRows.map((r) => ({
    roundNumber: r.number,
    playerIds: byeRows.filter((b) => b.roundId === r.id).map((b) => b.playerId),
  }));
  return {
    roster,
    schedule,
    byes,
    roundId,
    courtOf: new Map(matchRows.map((m) => [m.id, m.court])),
  };
}

async function applyPlan(
  tx: Transaction,
  plan: SubstitutionPlan,
  roundId: ReadonlyMap<number, string>,
): Promise<void> {
  for (const update of plan.matchUpdates) {
    await tx
      .update(matches)
      .set({
        teamA1: update.teamA[0],
        teamA2: update.teamA[1],
        teamB1: update.teamB[0],
        teamB2: update.teamB[1],
      })
      .where(and(eq(matches.id, update.matchId), eq(matches.status, "scheduled")));
  }
  for (const bye of plan.byeUpdates) {
    const id = roundId.get(bye.roundNumber)!;
    await tx.delete(roundByes).where(eq(roundByes.roundId, id));
    if (bye.playerIds.length > 0) {
      await tx
        .insert(roundByes)
        .values(bye.playerIds.map((playerId) => ({ roundId: id, playerId })));
    }
  }
  for (const { playerId, ...changes } of plan.playerUpdates) {
    await tx.update(players).set(changes).where(eq(players.id, playerId));
  }
}

/**
 * Replaces a player (temporary or permanent). With `dryRun` nothing is written — the wizard uses
 * it to show which matches change before the host confirms.
 */
export async function substitutePlayer(
  db: Database,
  tournamentId: string,
  request: SubstitutionRequest,
  options: { readonly dryRun?: boolean; readonly actorUserId?: string | null } = {},
): Promise<SubstitutionResult> {
  return db.transaction(async (tx) => {
    const [tournament] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .for("update")
      .limit(1);
    if (!tournament) throw new AppError("NOT_FOUND", "Tournament not found.");
    if (tournament.status !== "active")
      throw new AppError(
        "INVALID_STATE",
        "Players can be replaced while the tournament is running.",
      );

    const state = await loadState(tx, tournamentId);
    const { substitute } = request;
    let inPlayer: { id: string; name: string };

    if (substitute.source === "new_player") {
      const name = parsePlayerName(substitute.name);
      await assertNameAvailable(tx, tournamentId, name);
      inPlayer = options.dryRun
        ? { id: PREVIEW_PLAYER_ID, name }
        : (
            await tx
              .insert(players)
              .values({
                tournamentId,
                name,
                position: await nextPosition(tx, tournamentId),
                joinedRound: request.fromRound,
              })
              .returning({ id: players.id, name: players.name })
          )[0]!;
    } else {
      const found = state.roster.find((p) => p.id === substitute.playerId);
      inPlayer = { id: substitute.playerId, name: found?.name ?? "" };
    }

    const plan = planSubstitution({
      type: request.type,
      fromRound: request.fromRound,
      outPlayerId: request.outPlayerId,
      substitute: { source: substitute.source, playerId: inPlayer.id },
      players: [
        ...state.roster.map((p) => ({ id: p.id, status: p.status })),
        // A new player was created (or simulated) after the roster was loaded.
        ...(substitute.source === "new_player"
          ? [{ id: inPlayer.id, status: "active" as const }]
          : []),
      ],
      matches: state.schedule,
      byes: state.byes,
    });
    if (!plan.ok) throw new AppError("VALIDATION_ERROR", plan.error.message);

    const affected = plan.value.matchUpdates
      .map((u) => ({
        round: state.schedule.find((m) => m.id === u.matchId)!.roundNumber,
        court: state.courtOf.get(u.matchId)!,
      }))
      .sort((a, b) => a.round - b.round || a.court - b.court);
    const result = {
      inPlayer: {
        id: options.dryRun && inPlayer.id === PREVIEW_PLAYER_ID ? null : inPlayer.id,
        name: inPlayer.name,
      },
      affected,
    };
    if (options.dryRun) return result;

    await applyPlan(tx, plan.value, state.roundId);
    await tx.insert(substitutions).values({
      tournamentId,
      type: request.type,
      fromRound: request.fromRound,
      outPlayerId: request.outPlayerId,
      inPlayerId: inPlayer.id,
      source: substitute.source,
      affectedMatchIds: plan.value.matchUpdates.map((u) => u.matchId),
      createdByUserId: options.actorUserId ?? null,
    });
    await notifyTournament(tx, { tournamentId, type: "tournament.updated" });
    return result;
  });
}
