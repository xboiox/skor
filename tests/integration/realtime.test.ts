import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getSql } from "@/server/db/client";
import { matches, rounds } from "@/server/db/schema";
import { applyScoreAction } from "@/server/matches/score-actions";
import type { TournamentEvent } from "@/server/realtime/events";
import { getHub } from "@/server/realtime/hub";
import { notifyTournament } from "@/server/realtime/notify";
import { createTournament } from "@/server/tournaments/create";
import { endTournament } from "@/server/tournaments/flow";
import { startTournament } from "@/server/tournaments/start";
import { connectTestDb, TEST_DATABASE_URL, truncateAll } from "./test-db";

process.env.DATABASE_URL = TEST_DATABASE_URL;
const { sql, db } = connectTestDb();
const WAIT_MS = 3000;

async function started() {
  const { tournament } = await createTournament(
    db,
    {
      name: "Live",
      date: "2026-10-03",
      matchType: "americano",
      courts: 1,
      scoring: { type: "rally", totalPoints: 16 },
      players: ["A", "B", "C", "D"],
    },
    { ownerId: null, guestTtlDays: 7 },
  );
  await startTournament(db, tournament.id);
  const [r1] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.tournamentId, tournament.id), eq(rounds.number, 1)));
  const [match] = await db.select().from(matches).where(eq(matches.roundId, r1!.id));
  return { tournamentId: tournament.id, match: match! };
}

/** Subscribes and resolves with the first event, or null after WAIT_MS. */
async function nextEvent(
  tournamentId: string,
): Promise<{ events: TournamentEvent[]; first: Promise<TournamentEvent | null> }> {
  const events: TournamentEvent[] = [];
  let resolve!: (e: TournamentEvent | null) => void;
  const first = new Promise<TournamentEvent | null>((r) => (resolve = r));
  const unsubscribe = await getHub().subscribe(tournamentId, (event) => {
    events.push(event);
    resolve(event);
  });
  setTimeout(() => {
    unsubscribe();
    resolve(null);
  }, WAIT_MS);
  return { events, first };
}

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await getHub().close();
  await sql.end();
  await getSql().end();
});

describe("realtime hub", () => {
  it("delivers a match update to subscribers of that tournament, with the new state", async () => {
    const { tournamentId, match } = await started();
    const { first } = await nextEvent(tournamentId);

    await applyScoreAction(db, {
      matchId: match.id,
      expectedVersion: 0,
      actor: { role: "host", userId: null },
      action: { type: "point", team: "A" },
    });

    expect(await first).toMatchObject({
      tournamentId,
      type: "match.updated",
      match: { id: match.id, scoreA: 1, version: 1 },
    });
  });

  it("does not deliver events of other tournaments", async () => {
    const one = await started();
    const two = await started();
    const { events, first } = await nextEvent(two.tournamentId);
    await endTournament(db, one.tournamentId);
    await new Promise((r) => setTimeout(r, 500));
    expect(events).toHaveLength(0);
    void first;
  });

  it("announces tournament changes such as ending it", async () => {
    const { tournamentId } = await started();
    const { first } = await nextEvent(tournamentId);
    await endTournament(db, tournamentId);
    expect(await first).toEqual({ tournamentId, type: "tournament.updated" });
  });

  it("sends nothing when the transaction rolls back", async () => {
    const { tournamentId } = await started();
    const { events } = await nextEvent(tournamentId);
    await db
      .transaction(async (tx) => {
        await notifyTournament(tx, { tournamentId, type: "tournament.updated" });
        throw new Error("rollback");
      })
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, 500));
    expect(events).toHaveLength(0);
  });

  it("stops delivering after unsubscribe", async () => {
    const { tournamentId } = await started();
    const received: TournamentEvent[] = [];
    const unsubscribe = await getHub().subscribe(tournamentId, (e) => received.push(e));
    unsubscribe();
    await endTournament(db, tournamentId);
    await new Promise((r) => setTimeout(r, 500));
    expect(received).toHaveLength(0);
  });
});
