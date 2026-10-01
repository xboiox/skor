import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/api-response";
import type { CreateTournamentInput } from "@/lib/validation/tournament";
import { verifyAccessToken } from "@/server/access/access-repository";
import { matches, roundByes, rounds, tournaments, users } from "@/server/db/schema";
import { createTournament } from "@/server/tournaments/create";
import { addPlayer, removePlayer } from "@/server/tournaments/players";
import { listOwnedTournaments, getTournamentOverview } from "@/server/tournaments/queries";
import { startTournament } from "@/server/tournaments/start";
import { connectTestDb, truncateAll } from "./test-db";

const { sql, db } = connectTestDb();
const NOW = new Date("2026-10-01T10:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const names = (n: number) => Array.from({ length: n }, (_, i) => `Player ${i + 1}`);

function input(overrides: Partial<CreateTournamentInput> = {}): CreateTournamentInput {
  return {
    name: "Friday Americano",
    date: "2026-10-03",
    matchType: "americano",
    courts: 2,
    scoring: { type: "rally", totalPoints: 24 },
    players: names(8),
    ...overrides,
  };
}

const guest = { ownerId: null, guestTtlDays: 7, now: NOW };

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

describe("createTournament", () => {
  it("creates a guest tournament that expires after the TTL, with players and access links", async () => {
    const { tournament, tokens } = await createTournament(db, input(), guest);

    const [row] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(row).toMatchObject({
      name: "Friday Americano",
      status: "draft",
      ownerId: null,
      rallyPoints: 24,
      tennisMode: null,
      expiresAt: new Date(NOW.getTime() + 7 * DAY_MS),
    });
    expect(tournament.slug).toMatch(/^[2-9a-z]{6}$/);
    expect(await verifyAccessToken(db, tournament.slug, "admin", tokens.admin)).not.toBeNull();
    expect(await verifyAccessToken(db, tournament.slug, "player", tokens.player)).not.toBeNull();

    const overview = await getTournamentOverview(db, tournament.id);
    expect(overview?.players.map((p) => [p.name, p.position])).toEqual(
      names(8).map((n, i) => [n, i]),
    );
  });

  it("keeps a tournament owned by an account (no expiry)", async () => {
    const [owner] = await db
      .insert(users)
      .values({ name: "Host", email: "host@example.com" })
      .returning();
    const { tournament } = await createTournament(db, input(), { ...guest, ownerId: owner!.id });
    const [row] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(row).toMatchObject({ ownerId: owner!.id, expiresAt: null });
  });

  it("stores tennis scoring settings", async () => {
    const { tournament } = await createTournament(
      db,
      input({ scoring: { type: "tennis", mode: "first_to", games: 6, deuce: "advantage" } }),
      guest,
    );
    const [row] = await db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    expect(row).toMatchObject({
      scoringType: "tennis",
      rallyPoints: null,
      tennisMode: "first_to",
      tennisGames: 6,
      deuceRule: "advantage",
    });
  });
});

describe("players in draft", () => {
  it("adds a player at the end of the list", async () => {
    const { tournament } = await createTournament(db, input(), guest);
    const player = await addPlayer(db, tournament.id, "  New   Player ");
    expect(player).toMatchObject({ name: "New Player", position: 8 });
  });

  it("rejects a duplicate name regardless of case, naming the existing player", async () => {
    const { tournament } = await createTournament(db, input(), guest);
    await expect(addPlayer(db, tournament.id, "player 1")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Player 1 is already in this tournament.",
    });
  });

  it("rejects an empty name", async () => {
    const { tournament } = await createTournament(db, input(), guest);
    expect(await errorCode(addPlayer(db, tournament.id, "   "))).toBe("VALIDATION_ERROR");
  });

  it("removes a player", async () => {
    const { tournament } = await createTournament(db, input(), guest);
    const overview = await getTournamentOverview(db, tournament.id);
    await removePlayer(db, tournament.id, overview!.players[0]!.id);
    expect((await getTournamentOverview(db, tournament.id))?.players).toHaveLength(7);
  });

  it("refuses to remove a player of another tournament", async () => {
    const a = await createTournament(db, input(), guest);
    const b = await createTournament(db, input(), guest);
    const other = (await getTournamentOverview(db, b.tournament.id))!.players[0]!;
    expect(await errorCode(removePlayer(db, a.tournament.id, other.id))).toBe("NOT_FOUND");
  });

  it("locks the roster once the tournament has started", async () => {
    const { tournament } = await createTournament(db, input(), guest);
    await startTournament(db, tournament.id);
    const first = (await getTournamentOverview(db, tournament.id))!.players[0]!;
    expect(await errorCode(addPlayer(db, tournament.id, "Late"))).toBe("INVALID_STATE");
    expect(await errorCode(removePlayer(db, tournament.id, first.id))).toBe("INVALID_STATE");
  });
});

describe("startTournament", () => {
  it("schedules every Americano round up front, round 1 active", async () => {
    const { tournament } = await createTournament(db, input(), guest);
    await startTournament(db, tournament.id);

    const allRounds = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournament.id))
      .orderBy(rounds.number);
    expect(allRounds).toHaveLength(7);
    expect(allRounds.map((r) => r.status)).toEqual(["active", ...Array(6).fill("pending")]);
    expect(
      await db.select().from(matches).where(eq(matches.tournamentId, tournament.id)),
    ).toHaveLength(14);

    const overview = await getTournamentOverview(db, tournament.id);
    expect(overview?.tournament.status).toBe("active");
  });

  it("schedules only round 1 for Mexicano, with byes", async () => {
    const { tournament } = await createTournament(
      db,
      input({ matchType: "mexicano", players: names(10) }),
      guest,
    );
    await startTournament(db, tournament.id);

    const allRounds = await db.select().from(rounds).where(eq(rounds.tournamentId, tournament.id));
    expect(allRounds).toHaveLength(1);
    expect(
      await db.select().from(matches).where(eq(matches.roundId, allRounds[0]!.id)),
    ).toHaveLength(2);
    expect(
      await db.select().from(roundByes).where(eq(roundByes.roundId, allRounds[0]!.id)),
    ).toHaveLength(2);
  });

  it("refuses to start twice", async () => {
    const { tournament } = await createTournament(db, input(), guest);
    await startTournament(db, tournament.id);
    expect(await errorCode(startTournament(db, tournament.id))).toBe("INVALID_STATE");
  });

  it("creates exactly one schedule when two starts race", async () => {
    const { tournament } = await createTournament(db, input(), guest);
    const results = await Promise.allSettled([
      startTournament(db, tournament.id),
      startTournament(db, tournament.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.select().from(rounds).where(eq(rounds.tournamentId, tournament.id)),
    ).toHaveLength(7);
  });

  it("needs at least 4 players", async () => {
    const { tournament } = await createTournament(db, input({ players: names(4) }), guest);
    const first = (await getTournamentOverview(db, tournament.id))!.players[0]!;
    await removePlayer(db, tournament.id, first.id);
    expect(await errorCode(startTournament(db, tournament.id))).toBe("VALIDATION_ERROR");
  });

  it("reports an unknown tournament as NOT_FOUND", async () => {
    expect(await errorCode(startTournament(db, "00000000-0000-4000-8000-000000000000"))).toBe(
      "NOT_FOUND",
    );
  });
});

describe("listOwnedTournaments", () => {
  it("lists only the owner's tournaments, newest date first, with player counts", async () => {
    const [owner] = await db
      .insert(users)
      .values({ name: "Host", email: "host@example.com" })
      .returning();
    const opts = { ...guest, ownerId: owner!.id };
    await createTournament(db, input({ name: "Older", date: "2026-09-01" }), opts);
    await createTournament(
      db,
      input({ name: "Newer", date: "2026-10-05", players: names(5) }),
      opts,
    );
    await createTournament(db, input({ name: "Someone else's" }), guest);

    const list = await listOwnedTournaments(db, owner!.id);
    expect(list.map((t) => [t.name, t.playerCount])).toEqual([
      ["Newer", 5],
      ["Older", 8],
    ]);
  });
});
