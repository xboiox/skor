import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/cleanup/route";
import { getSql } from "@/server/db/client";
import { tournaments } from "@/server/db/schema";
import { deleteExpiredTournaments } from "@/server/tournaments/cleanup";
import { createTournament } from "@/server/tournaments/create";
import { connectTestDb, TEST_DATABASE_URL, truncateAll } from "./test-db";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.CRON_SECRET = "test-cron-secret-0123456789";
const { sql, db } = connectTestDb();
const HOUR_MS = 60 * 60 * 1000;

async function tournament(name: string, ownerId: string | null, expiresAt: Date | null) {
  const { tournament: t } = await createTournament(
    db,
    {
      name,
      date: "2026-10-03",
      matchType: "mexicano",
      courts: 1,
      scoring: { type: "rally", totalPoints: 16 },
      players: ["A", "B", "C", "D"],
    },
    { ownerId, guestTtlDays: 7 },
  );
  await db.update(tournaments).set({ expiresAt }).where(eq(tournaments.id, t.id));
  return t;
}

const call = (authorization?: string) =>
  GET(
    new Request("http://localhost:3000/api/cron/cleanup", {
      headers: authorization ? { authorization } : {},
    }),
    {},
  );

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await sql.end();
  await getSql().end();
});

describe("deleteExpiredTournaments", () => {
  it("deletes only guest tournaments past their expiry", async () => {
    await tournament("Expired", null, new Date(Date.now() - HOUR_MS));
    await tournament("Still valid", null, new Date(Date.now() + HOUR_MS));
    expect(await deleteExpiredTournaments(db)).toBe(1);
    expect(
      (await db.select({ name: tournaments.name }).from(tournaments)).map((t) => t.name),
    ).toEqual(["Still valid"]);
  });
});

describe("GET /api/cron/cleanup", () => {
  it("refuses calls without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-secret-0000000000")).status).toBe(401);
  });

  it("runs the cleanup when Vercel Cron calls with the secret", async () => {
    await tournament("Expired", null, new Date(Date.now() - HOUR_MS));
    const res = await call(`Bearer ${process.env.CRON_SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { deleted: 1 }, error: null });
  });
});
