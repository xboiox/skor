import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { issueAccessTokens } from "@/server/access/access-repository";
import { exchangeAccessLink } from "@/server/access/exchange";
import { tournaments } from "@/server/db/schema";
import { connectTestDb, truncateAll } from "./test-db";

const { sql, db } = connectTestDb();

async function guestTournament(slug: string, expiresInMs: number) {
  const [t] = await db
    .insert(tournaments)
    .values({
      slug,
      name: "Guest",
      date: "2026-10-03",
      matchType: "mexicano",
      courts: 1,
      scoringType: "rally",
      rallyPoints: 16,
      rngSeed: 1,
      expiresAt: new Date(Date.now() + expiresInMs),
    })
    .returning();
  return { t: t!, tokens: await issueAccessTokens(db, t!.id) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await sql.end();
});

describe("exchangeAccessLink", () => {
  it("turns a valid admin link into an httpOnly cookie and a clean admin URL", async () => {
    const { tokens } = await guestTournament("abc123", 7 * DAY_MS);
    const result = await exchangeAccessLink(db, {
      slug: "abc123",
      role: "admin",
      token: tokens.admin,
      isSecure: true,
    });
    expect(result).toMatchObject({
      redirectTo: "/t/abc123/admin",
      cookie: {
        name: "skor_admin_abc123",
        value: tokens.admin,
        options: { httpOnly: true, secure: true },
      },
    });
    // Cookie lives as long as the guest tournament (≈ 7 days)
    expect(result!.cookie.options.maxAge).toBeGreaterThan(7 * 24 * 3600 - 60);
  });

  it("sends player links to the player view", async () => {
    const { tokens } = await guestTournament("abc123", DAY_MS);
    const result = await exchangeAccessLink(db, {
      slug: "abc123",
      role: "player",
      token: tokens.player,
      isSecure: false,
    });
    expect(result).toMatchObject({
      redirectTo: "/t/abc123/play",
      cookie: { name: "skor_player_abc123" },
    });
  });

  it("rejects a wrong token, a wrong role and an unknown role", async () => {
    const { tokens } = await guestTournament("abc123", DAY_MS);
    expect(
      await exchangeAccessLink(db, {
        slug: "abc123",
        role: "admin",
        token: "nope",
        isSecure: true,
      }),
    ).toBeNull();
    expect(
      await exchangeAccessLink(db, {
        slug: "abc123",
        role: "admin",
        token: tokens.player,
        isSecure: true,
      }),
    ).toBeNull();
    expect(
      await exchangeAccessLink(db, {
        slug: "abc123",
        role: "owner",
        token: tokens.admin,
        isSecure: true,
      }),
    ).toBeNull();
  });

  it("rejects links of an expired tournament", async () => {
    const { tokens } = await guestTournament("old999", -DAY_MS);
    expect(
      await exchangeAccessLink(db, {
        slug: "old999",
        role: "admin",
        token: tokens.admin,
        isSecure: true,
      }),
    ).toBeNull();
  });

  it("rejects missing or oversized tokens without querying", async () => {
    await guestTournament("abc123", DAY_MS);
    expect(
      await exchangeAccessLink(db, { slug: "abc123", role: "admin", token: "", isSecure: true }),
    ).toBeNull();
    expect(
      await exchangeAccessLink(db, {
        slug: "abc123",
        role: "admin",
        token: "x".repeat(500),
        isSecure: true,
      }),
    ).toBeNull();
  });
});
