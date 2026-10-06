import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/api-response";
import { matches, players, roundByes, rounds, substitutions } from "@/server/db/schema";
import { createTournament } from "@/server/tournaments/create";
import { startTournament } from "@/server/tournaments/start";
import { substitutePlayer } from "@/server/tournaments/substitute";
import { connectTestDb, truncateAll } from "./test-db";

const { sql, db } = connectTestDb();

async function setup(playerCount = 10) {
  const { tournament } = await createTournament(
    db,
    {
      name: "Subs",
      date: "2026-10-03",
      matchType: "americano",
      courts: 2,
      scoring: { type: "rally", totalPoints: 16 },
      players: Array.from({ length: playerCount }, (_, i) => `P${i + 1}`),
    },
    { ownerId: null, guestTtlDays: 7 },
  );
  await startTournament(db, tournament.id);
  const [r1] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.tournamentId, tournament.id), eq(rounds.number, 1)));
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.roundId, r1!.id))
    .orderBy(asc(matches.court))
    .limit(1);
  const byes = await db.select().from(roundByes).where(eq(roundByes.roundId, r1!.id));
  return {
    id: tournament.id,
    roundOneId: r1!.id,
    match: match!,
    outId: match!.teamA1,
    byeId: byes[0]?.playerId,
  };
}

const slotsOf = (m: typeof matches.$inferSelect) => [m.teamA1, m.teamA2, m.teamB1, m.teamB2];

async function errorOf(promise: Promise<unknown>): Promise<AppError | null> {
  return promise.then(
    () => null,
    (err: unknown) => {
      if (err instanceof AppError) return err;
      throw err;
    },
  );
}

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await sql.end();
});

describe("substitutePlayer", () => {
  it("temporary: a bye player takes the slot for that round only", async () => {
    const { id, match, outId, byeId, roundOneId } = await setup();
    const result = await substitutePlayer(db, id, {
      type: "temporary",
      fromRound: 1,
      outPlayerId: outId,
      substitute: { source: "bye_player", playerId: byeId! },
    });
    expect(result.affected).toEqual([{ round: 1, court: 1 }]);

    const [after] = await db.select().from(matches).where(eq(matches.id, match.id));
    expect(slotsOf(after!)).toContain(byeId);
    expect(slotsOf(after!)).not.toContain(outId);
    const byes = await db.select().from(roundByes).where(eq(roundByes.roundId, roundOneId));
    expect(byes.map((b) => b.playerId)).not.toContain(byeId);

    const [record] = await db.select().from(substitutions);
    expect(record).toMatchObject({
      type: "temporary",
      source: "bye_player",
      outPlayerId: outId,
      inPlayerId: byeId,
    });
  });

  it("temporary: a new player plays one round and is inactive afterwards", async () => {
    const { id, match, outId } = await setup();
    const result = await substitutePlayer(db, id, {
      type: "temporary",
      fromRound: 1,
      outPlayerId: outId,
      substitute: { source: "new_player", name: "Guest Star" },
    });
    const [sub] = await db.select().from(players).where(eq(players.id, result.inPlayer.id!));
    expect(sub).toMatchObject({
      name: "Guest Star",
      joinedRound: 1,
      status: "withdrawn",
      withdrawnFromRound: 2,
    });
    const [after] = await db.select().from(matches).where(eq(matches.id, match.id));
    expect(slotsOf(after!)).toContain(sub!.id);
  });

  it("permanent: the new player takes every remaining scheduled slot", async () => {
    const { id, outId } = await setup(8);
    const result = await substitutePlayer(db, id, {
      type: "permanent",
      fromRound: 2,
      outPlayerId: outId,
      substitute: { source: "new_player", name: "Replacement" },
    });
    expect(result.affected.every((a) => a.round >= 2)).toBe(true);
    expect(result.affected.length).toBeGreaterThan(0);

    const all = await db.select().from(matches).where(eq(matches.tournamentId, id));
    const roundOf = new Map(
      (await db.select().from(rounds).where(eq(rounds.tournamentId, id))).map((r) => [
        r.id,
        r.number,
      ]),
    );
    for (const m of all) {
      const has = slotsOf(m).includes(outId);
      expect(has).toBe(roundOf.get(m.roundId) === 1 && has);
    }
    const [out] = await db.select().from(players).where(eq(players.id, outId));
    expect(out).toMatchObject({ status: "withdrawn", withdrawnFromRound: 2 });
  });

  it("preview reports the change without saving anything", async () => {
    const { id, outId } = await setup(8);
    const result = await substitutePlayer(
      db,
      id,
      {
        type: "permanent",
        fromRound: 2,
        outPlayerId: outId,
        substitute: { source: "new_player", name: "Maybe" },
      },
      { dryRun: true },
    );
    expect(result.affected.length).toBeGreaterThan(0);
    expect(result.inPlayer.name).toBe("Maybe");
    expect(await db.select().from(substitutions)).toHaveLength(0);
    expect(await db.select().from(players).where(eq(players.name, "Maybe"))).toHaveLength(0);
  });

  it("refuses a bye player as a permanent substitute (A8)", async () => {
    const { id, outId, byeId } = await setup();
    const error = await errorOf(
      substitutePlayer(db, id, {
        type: "permanent",
        fromRound: 1,
        outPlayerId: outId,
        substitute: { source: "bye_player", playerId: byeId! },
      }),
    );
    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "A permanent substitute must be a new player.",
    });
  });

  it("refuses a new player whose name is taken, and saves nothing", async () => {
    const { id, outId } = await setup();
    const error = await errorOf(
      substitutePlayer(db, id, {
        type: "temporary",
        fromRound: 1,
        outPlayerId: outId,
        substitute: { source: "new_player", name: "p2" },
      }),
    );
    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "P2 is already in this tournament.",
    });
    expect(await db.select().from(substitutions)).toHaveLength(0);
  });

  it("refuses when the match has already started", async () => {
    const { id, match, outId } = await setup();
    await db
      .update(matches)
      .set({ status: "in_progress", scoreA: 1 })
      .where(eq(matches.id, match.id));
    const error = await errorOf(
      substitutePlayer(db, id, {
        type: "temporary",
        fromRound: 1,
        outPlayerId: outId,
        substitute: { source: "new_player", name: "Late" },
      }),
    );
    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "That match has already started.",
    });
    expect(await db.select().from(players).where(eq(players.name, "Late"))).toHaveLength(0);
  });
});
