import { and, desc, eq, ne } from "drizzle-orm";
import { computeLeaderboard } from "@/domain/leaderboard";
import { generateMexicanoRound, repeatAsSecondLeg, type PlannedRound } from "@/domain/scheduling";
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
import { loadSchedule } from "./schedule-load";
import { saveRounds } from "./schedule-store";

async function lockActiveTournament(tx: Transaction, tournamentId: string) {
  const [tournament] = await tx
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .for("update")
    .limit(1);
  if (!tournament) throw new AppError("NOT_FOUND", "Tournament not found.");
  if (tournament.status !== "active")
    throw new AppError("INVALID_STATE", "This tournament is not running.");
  return tournament;
}

/** Mexicano: builds the next round from the approved standings once the current round is fully approved. */
export async function nextMexicanoRound(
  db: Database,
  tournamentId: string,
): Promise<{ number: number }> {
  return db.transaction(async (tx) => {
    const tournament = await lockActiveTournament(tx, tournamentId);
    if (tournament.matchType !== "mexicano") {
      throw new AppError(
        "INVALID_STATE",
        "Americano rounds are all scheduled when the tournament starts.",
      );
    }

    const [latest] = await tx
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournamentId))
      .orderBy(desc(rounds.number))
      .limit(1);
    const [open] = await tx
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.roundId, latest!.id), ne(matches.status, "approved")))
      .limit(1);
    if (open)
      throw new AppError("INVALID_STATE", `Approve every result of round ${latest!.number} first.`);

    const [roster, matchRows, byeRows] = await Promise.all([
      tx.select().from(players).where(eq(players.tournamentId, tournamentId)),
      tx.select().from(matches).where(eq(matches.tournamentId, tournamentId)),
      tx
        .select({ playerId: roundByes.playerId })
        .from(roundByes)
        .where(eq(roundByes.roundId, latest!.id)),
    ]);
    const board = computeLeaderboard({
      mode: "final",
      players: roster.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        joinedRound: p.joinedRound,
      })),
      matches: matchRows.map((m) => ({
        id: m.id,
        status: m.status,
        teamA: [m.teamA1, m.teamA2] as const,
        teamB: [m.teamB1, m.teamB2] as const,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
      })),
    });
    const active = new Set(roster.filter((p) => p.status === "active").map((p) => p.id));
    const number = latest!.number + 1;

    const round = generateMexicanoRound({
      ranking: board.rows.filter((r) => active.has(r.playerId)).map((r) => r.playerId),
      courts: tournament.courts,
      roundNumber: number,
      playedCounts: new Map(board.rows.map((r) => [r.playerId, r.played])),
      previousByes: new Set(byeRows.map((b) => b.playerId)),
      seed: tournament.rngSeed + number,
    });
    if (!round.ok) throw new AppError("VALIDATION_ERROR", round.error.message);

    await saveRounds(tx, tournamentId, [round.value], number);
    await notifyTournament(tx, { tournamentId, type: "tournament.updated" });
    return { number };
  });
}

/** out → in for permanent substitutions, following chains (A replaced by B, later B by C → A maps to C). */
async function permanentReplacements(
  tx: Transaction,
  tournamentId: string,
): Promise<Map<string, string>> {
  const rows = await tx
    .select({ out: substitutions.outPlayerId, in: substitutions.inPlayerId })
    .from(substitutions)
    .where(and(eq(substitutions.tournamentId, tournamentId), eq(substitutions.type, "permanent")));
  const direct = new Map(rows.map((r) => [r.out, r.in]));
  const resolve = (id: string, seen = new Set<string>()): string => {
    const next = direct.get(id);
    if (!next || seen.has(next)) return id;
    return resolve(next, new Set([...seen, id]));
  };
  return new Map([...direct.keys()].map((id) => [id, resolve(id)]));
}

function withReplacements(
  schedule: readonly PlannedRound[],
  replace: ReadonlyMap<string, string>,
): PlannedRound[] {
  const swap = (id: string) => replace.get(id) ?? id;
  return schedule.map((round) => ({
    ...round,
    matches: round.matches.map((m) => ({
      ...m,
      teamA: [swap(m.teamA[0]), swap(m.teamA[1])] as const,
      teamB: [swap(m.teamB[0]), swap(m.teamB[1])] as const,
    })),
    byes: round.byes.map(swap),
  }));
}

/** Americano home/away: replays the first leg with sides swapped (once). */
export async function repeatAmericano(
  db: Database,
  tournamentId: string,
): Promise<{ rounds: number }> {
  return db.transaction(async (tx) => {
    const tournament = await lockActiveTournament(tx, tournamentId);
    if (tournament.matchType !== "americano") {
      throw new AppError("INVALID_STATE", "Repeat is for Americano. In Mexicano, use Next round.");
    }
    if (tournament.currentLeg === 2)
      throw new AppError("INVALID_STATE", "This tournament has already been repeated.");

    const schedule = await loadSchedule(tx, tournamentId);
    const firstLeg = withReplacements(
      schedule.filter((r) => r.leg === 1),
      await permanentReplacements(tx, tournamentId),
    );
    const secondLeg = repeatAsSecondLeg(firstLeg);
    if (!secondLeg.ok) throw new AppError("INVALID_STATE", secondLeg.error.message);

    const [running] = await tx
      .select({ id: rounds.id })
      .from(rounds)
      .where(and(eq(rounds.tournamentId, tournamentId), ne(rounds.status, "completed")))
      .limit(1);
    await saveRounds(
      tx,
      tournamentId,
      secondLeg.value,
      running ? null : secondLeg.value[0]!.number,
    );
    await tx.update(tournaments).set({ currentLeg: 2 }).where(eq(tournaments.id, tournamentId));
    await notifyTournament(tx, { tournamentId, type: "tournament.updated" });
    return { rounds: secondLeg.value.length };
  });
}

export async function endTournament(db: Database, tournamentId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockActiveTournament(tx, tournamentId);
    await tx
      .update(tournaments)
      .set({ status: "finished" })
      .where(eq(tournaments.id, tournamentId));
    await notifyTournament(tx, { tournamentId, type: "tournament.updated" });
  });
}
