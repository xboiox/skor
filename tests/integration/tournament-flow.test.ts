import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/api-response";
import type { CreateTournamentInput } from "@/lib/validation/tournament";
import {
  matches,
  players,
  roundByes,
  rounds,
  substitutions,
  tournaments,
} from "@/server/db/schema";
import { editMatchScore } from "@/server/matches/host-actions";
import type { Actor } from "@/server/matches/score-actions";
import { createTournament } from "@/server/tournaments/create";
import { endTournament, nextMexicanoRound, repeatAmericano } from "@/server/tournaments/flow";
import { startTournament } from "@/server/tournaments/start";
import { connectTestDb, truncateAll } from "./test-db";

const { sql, db } = connectTestDb();
const HOST: Actor = { role: "host", userId: null };
const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

async function started(overrides: Partial<CreateTournamentInput>) {
  const { tournament } = await createTournament(
    db,
    {
      name: "Flow",
      date: "2026-10-03",
      matchType: "mexicano",
      courts: 2,
      scoring: { type: "rally", totalPoints: 16 },
      players: names(8),
      ...overrides,
    },
    { ownerId: null, guestTtlDays: 7 },
  );
  await startTournament(db, tournament.id);
  return tournament.id;
}

async function roundMatches(tournamentId: string, number: number) {
  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.number, number)));
  return db
    .select()
    .from(matches)
    .where(eq(matches.roundId, round!.id))
    .orderBy(asc(matches.court));
}

/** Approves every match of a round with team A winning `winA`-(16-winA). */
async function approveRound(tournamentId: string, number: number, winA = 12) {
  for (const m of await roundMatches(tournamentId, number)) {
    await editMatchScore(db, {
      matchId: m.id,
      expectedVersion: m.version,
      actor: HOST,
      scoreA: winA,
      scoreB: 16 - winA,
    });
  }
}

async function errorCode(promise: Promise<unknown>): Promise<string | null> {
  return promise.then(
    () => null,
    (err: unknown) => (err instanceof AppError ? err.code : `UNEXPECTED: ${String(err)}`),
  );
}

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await sql.end();
});

describe("nextMexicanoRound", () => {
  it("waits until every match of the current round is approved", async () => {
    const id = await started({});
    expect(await errorCode(nextMexicanoRound(db, id))).toBe("INVALID_STATE");
  });

  it("pairs round 2 by the standings: 1&3 vs 2&4 on court 1", async () => {
    const id = await started({});
    await approveRound(id, 1, 12);
    const round = await nextMexicanoRound(db, id);
    expect(round.number).toBe(2);

    // Round 1 winners (12 points) are the top four; they meet on court 1.
    const r1 = await roundMatches(id, 1);
    const winners = new Set(r1.flatMap((m) => [m.teamA1, m.teamA2]));
    const [court1] = await roundMatches(id, 2);
    expect(
      [court1!.teamA1, court1!.teamA2, court1!.teamB1, court1!.teamB2].every((p) => winners.has(p)),
    ).toBe(true);

    const all = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, id))
      .orderBy(asc(rounds.number));
    expect(all.map((r) => r.status)).toEqual(["completed", "active"]);
  });

  it("rotates byes fairly and leaves withdrawn players out", async () => {
    const id = await started({ players: names(9) });
    const [r1Bye] = await db.select().from(roundByes);
    const [withdrawn] = await db
      .select()
      .from(players)
      .where(and(eq(players.tournamentId, id), eq(players.name, "P1")));
    await db
      .update(players)
      .set({ status: "withdrawn", withdrawnFromRound: 2 })
      .where(eq(players.id, withdrawn!.id));
    await approveRound(id, 1);
    await nextMexicanoRound(db, id);

    const r2 = await roundMatches(id, 2);
    const r2Players = r2.flatMap((m) => [m.teamA1, m.teamA2, m.teamB1, m.teamB2]);
    expect(r2Players).not.toContain(withdrawn!.id);
    expect(r2Players).toHaveLength(8);
    if (r1Bye!.playerId !== withdrawn!.id) expect(r2Players).toContain(r1Bye!.playerId);
  });

  it("is Mexicano only", async () => {
    const id = await started({ matchType: "americano" });
    expect(await errorCode(nextMexicanoRound(db, id))).toBe("INVALID_STATE");
  });
});

describe("repeatAmericano", () => {
  it("adds a second leg with sides swapped, numbered after the first", async () => {
    const id = await started({ matchType: "americano" });
    await repeatAmericano(db, id);

    const all = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, id))
      .orderBy(asc(rounds.number));
    expect(all).toHaveLength(14);
    expect(all.slice(7).every((r) => r.leg === 2)).toBe(true);
    const [first] = await roundMatches(id, 1);
    const [mirror] = await roundMatches(id, 8);
    expect([mirror!.teamA1, mirror!.teamA2]).toEqual([first!.teamB1, first!.teamB2]);
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    expect(t?.currentLeg).toBe(2);
  });

  it("can only repeat once", async () => {
    const id = await started({ matchType: "americano" });
    await repeatAmericano(db, id);
    expect(await errorCode(repeatAmericano(db, id))).toBe("INVALID_STATE");
  });

  it("uses the permanent substitute instead of a withdrawn player", async () => {
    const id = await started({ matchType: "americano" });
    const [first] = await roundMatches(id, 1);
    const outId = first!.teamA1;
    const [sub] = await db
      .insert(players)
      .values({ tournamentId: id, name: "Sub", position: 99, joinedRound: 3 })
      .returning();
    await db
      .update(players)
      .set({ status: "withdrawn", withdrawnFromRound: 3 })
      .where(eq(players.id, outId));
    await db.insert(substitutions).values({
      tournamentId: id,
      type: "permanent",
      fromRound: 3,
      outPlayerId: outId,
      inPlayerId: sub!.id,
      source: "new_player",
    });
    await repeatAmericano(db, id);

    const [mirror] = await roundMatches(id, 8);
    expect([mirror!.teamB1, mirror!.teamB2]).toContain(sub!.id);
    expect([mirror!.teamB1, mirror!.teamB2]).not.toContain(outId);
  });

  it("is Americano only", async () => {
    const id = await started({});
    expect(await errorCode(repeatAmericano(db, id))).toBe("INVALID_STATE");
  });
});

describe("endTournament", () => {
  it("finishes a running tournament and blocks further changes", async () => {
    const id = await started({});
    await endTournament(db, id);
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    expect(t?.status).toBe("finished");
    expect(await errorCode(endTournament(db, id))).toBe("INVALID_STATE");
    expect(await errorCode(nextMexicanoRound(db, id))).toBe("INVALID_STATE");
  });
});
