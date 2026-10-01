import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { matches, players, rounds, substitutions, tournaments, users } from "@/server/db/schema";
import { connectTestDb, truncateAll } from "./test-db";

const { sql, db } = connectTestDb();

const RALLY_TOURNAMENT = {
  slug: "abc123",
  name: "Friday Americano",
  date: "2026-10-03",
  matchType: "americano",
  courts: 2,
  scoringType: "rally",
  rallyPoints: 24,
  rngSeed: 42,
} as const;

async function createTournament(overrides: Partial<typeof tournaments.$inferInsert> = {}) {
  const [row] = await db
    .insert(tournaments)
    .values({ ...RALLY_TOURNAMENT, ...overrides })
    .returning();
  return row!;
}

async function createPlayers(tournamentId: string, names: string[]) {
  return db
    .insert(players)
    .values(names.map((name, position) => ({ tournamentId, name, position })))
    .returning();
}

// postgres.js wraps the server error; the constraint name sits on the cause.
async function expectConstraintViolation(promise: Promise<unknown>, constraint: string) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error, `expected ${constraint} to reject`).not.toBeNull();
  const cause = (error as { cause?: { constraint_name?: string } }).cause;
  expect(cause?.constraint_name).toBe(constraint);
}

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await sql.end();
});

describe("tournaments scoring config", () => {
  it("accepts a valid rally config", async () => {
    await expect(createTournament()).resolves.toMatchObject({ status: "draft", currentLeg: 1 });
  });

  it("accepts a valid tennis config", async () => {
    await expect(
      createTournament({
        scoringType: "tennis",
        rallyPoints: null,
        tennisMode: "first_to",
        tennisGames: 4,
        deuceRule: "golden_point",
      }),
    ).resolves.toBeDefined();
  });

  it("rejects rally points outside 16/21/24/32", async () => {
    await expectConstraintViolation(
      createTournament({ rallyPoints: 20 }),
      "tournaments_scoring_config",
    );
  });

  it("rejects tennis without a deuce rule", async () => {
    await expectConstraintViolation(
      createTournament({
        scoringType: "tennis",
        rallyPoints: null,
        tennisMode: "total_of",
        tennisGames: 6,
      }),
      "tournaments_scoring_config",
    );
  });

  it("rejects tennis games above 12", async () => {
    await expectConstraintViolation(
      createTournament({
        scoringType: "tennis",
        rallyPoints: null,
        tennisMode: "first_to",
        tennisGames: 13,
        deuceRule: "advantage",
      }),
      "tournaments_scoring_config",
    );
  });

  it("rejects more than 20 courts", async () => {
    await expectConstraintViolation(createTournament({ courts: 21 }), "tournaments_courts_range");
  });
});

describe("players", () => {
  it("rejects duplicate names in one tournament regardless of case", async () => {
    const t = await createTournament();
    await createPlayers(t.id, ["Andi"]);
    await expectConstraintViolation(
      createPlayers(t.id, ["andi"]),
      "players_tournament_name_unique",
    );
  });

  it("allows the same name in different tournaments", async () => {
    const t1 = await createTournament();
    const t2 = await createTournament({ slug: "def456" });
    await createPlayers(t1.id, ["Andi"]);
    await expect(createPlayers(t2.id, ["Andi"])).resolves.toHaveLength(1);
  });
});

describe("matches", () => {
  it("rejects a match with the same player twice", async () => {
    const t = await createTournament();
    const [a, b, c] = await createPlayers(t.id, ["A", "B", "C"]);
    const [round] = await db.insert(rounds).values({ tournamentId: t.id, number: 1 }).returning();
    await expectConstraintViolation(
      db.insert(matches).values({
        tournamentId: t.id,
        roundId: round!.id,
        court: 1,
        teamA1: a!.id,
        teamA2: b!.id,
        teamB1: c!.id,
        teamB2: a!.id,
      }),
      "matches_distinct_players",
    );
  });
});

describe("substitutions", () => {
  it("rejects a permanent substitution by an existing bye player", async () => {
    const t = await createTournament();
    const [out, sub] = await createPlayers(t.id, ["Out", "Sub"]);
    await expectConstraintViolation(
      db.insert(substitutions).values({
        tournamentId: t.id,
        type: "permanent",
        fromRound: 2,
        outPlayerId: out!.id,
        inPlayerId: sub!.id,
        source: "bye_player",
      }),
      "substitutions_permanent_new_player",
    );
  });
});

describe("guest cleanup script", () => {
  // Wide margin: the Docker VM clock can drift from the host clock.
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const cleanupSql = readFileSync("scripts/cleanup.sql", "utf8");

  it("deletes expired guest tournaments with all their rows and keeps the rest", async () => {
    // Arrange
    const [owner] = await db.insert(users).values({ email: "host@example.com" }).returning();
    const expired = await createTournament({
      slug: "expired",
      expiresAt: new Date(Date.now() - ONE_HOUR_MS),
    });
    const activeGuest = await createTournament({
      slug: "guest",
      expiresAt: new Date(Date.now() + ONE_HOUR_MS),
    });
    const owned = await createTournament({ slug: "owned", ownerId: owner!.id });
    const [p1, p2, p3, p4] = await createPlayers(expired.id, ["A", "B", "C", "D"]);
    const [round] = await db
      .insert(rounds)
      .values({ tournamentId: expired.id, number: 1 })
      .returning();
    await db.insert(matches).values({
      tournamentId: expired.id,
      roundId: round!.id,
      court: 1,
      teamA1: p1!.id,
      teamA2: p2!.id,
      teamB1: p3!.id,
      teamB2: p4!.id,
    });

    // Act
    await sql.unsafe(cleanupSql);

    // Assert
    const remaining = await db.select({ slug: tournaments.slug }).from(tournaments);
    expect(remaining.map((r) => r.slug).sort()).toEqual([activeGuest.slug, owned.slug].sort());
    expect(await db.select().from(players)).toHaveLength(0);
    expect(await db.select().from(matches)).toHaveLength(0);
  });
});
