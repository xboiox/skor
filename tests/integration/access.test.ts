import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/api-response";
import { issueAccessTokens, verifyAccessToken } from "@/server/access/access-repository";
import {
  requireHost,
  requireScorer,
  requireViewer,
  type AccessContext,
} from "@/server/access/guards";
import { accessCookieName, identityCookieName } from "@/server/access/tokens";
import { players, tournaments, users } from "@/server/db/schema";
import { connectTestDb, truncateAll } from "./test-db";

const { sql, db } = connectTestDb();

const BASE = {
  name: "Friday Americano",
  date: "2026-10-03",
  matchType: "americano",
  courts: 2,
  scoringType: "rally",
  rallyPoints: 24,
  rngSeed: 1,
} as const;

async function createTournament(
  slug: string,
  overrides: Partial<typeof tournaments.$inferInsert> = {},
) {
  const [row] = await db
    .insert(tournaments)
    .values({ ...BASE, slug, ...overrides })
    .returning();
  return row!;
}

function context(
  cookies: Record<string, string> = {},
  userId: string | null = null,
): AccessContext {
  return {
    db,
    userId,
    cookies: { get: (name) => (name in cookies ? { value: cookies[name]! } : undefined) },
  };
}

async function errorCode(promise: Promise<unknown>): Promise<string | null> {
  return promise.then(
    () => null,
    (err: unknown) => (err instanceof AppError ? err.code : "UNEXPECTED"),
  );
}

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await sql.end();
});

describe("access tokens", () => {
  it("issues an admin and a player token that verify for their own role only", async () => {
    const t = await createTournament("abc123");
    const tokens = await issueAccessTokens(db, t.id);

    expect(await verifyAccessToken(db, "abc123", "admin", tokens.admin)).toMatchObject({
      id: t.id,
    });
    expect(await verifyAccessToken(db, "abc123", "player", tokens.player)).toMatchObject({
      id: t.id,
    });
    expect(await verifyAccessToken(db, "abc123", "admin", tokens.player)).toBeNull();
    expect(await verifyAccessToken(db, "abc123", "player", "made-up")).toBeNull();
  });

  it("stores only hashes, never the tokens", async () => {
    const t = await createTournament("abc123");
    const tokens = await issueAccessTokens(db, t.id);
    const rows = await sql`select token_hash from access_tokens`;
    const stored = rows.map((r) => r.token_hash as string);
    expect(stored).not.toContain(tokens.admin);
    expect(stored).not.toContain(tokens.player);
  });

  it("rejects a token from another tournament", async () => {
    const a = await createTournament("aaa111");
    await createTournament("bbb222");
    const tokens = await issueAccessTokens(db, a.id);
    expect(await verifyAccessToken(db, "bbb222", "admin", tokens.admin)).toBeNull();
  });

  it("rejects tokens of an expired guest tournament", async () => {
    const t = await createTournament("old999", {
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const tokens = await issueAccessTokens(db, t.id);
    expect(await verifyAccessToken(db, "old999", "admin", tokens.admin)).toBeNull();
  });

  it("rotates tokens when issued again", async () => {
    const t = await createTournament("abc123");
    const first = await issueAccessTokens(db, t.id);
    const second = await issueAccessTokens(db, t.id);
    expect(await verifyAccessToken(db, "abc123", "admin", first.admin)).toBeNull();
    expect(await verifyAccessToken(db, "abc123", "admin", second.admin)).not.toBeNull();
  });
});

describe("guards", () => {
  async function setup() {
    const [owner] = await db
      .insert(users)
      .values({ name: "Owner", email: "owner@example.com" })
      .returning();
    const [other] = await db
      .insert(users)
      .values({ name: "Other", email: "other@example.com" })
      .returning();
    const t = await createTournament("abc123", { ownerId: owner!.id });
    const tokens = await issueAccessTokens(db, t.id);
    const [andi, budi] = await db
      .insert(players)
      .values([
        { tournamentId: t.id, name: "Andi", position: 0 },
        { tournamentId: t.id, name: "Budi", position: 1, status: "withdrawn" },
      ])
      .returning();
    const ref = { id: t.id, slug: t.slug, ownerId: t.ownerId };
    return { owner: owner!, other: other!, t: ref, tokens, andi: andi!, budi: budi! };
  }

  it("requireHost accepts the owner's session", async () => {
    const { owner, t } = await setup();
    await expect(requireHost(context({}, owner.id), t)).resolves.toEqual({
      role: "host",
      userId: owner.id,
    });
  });

  it("requireHost accepts a valid admin cookie (guest host)", async () => {
    const { t, tokens } = await setup();
    const ctx = context({ [accessCookieName("admin", t.slug)]: tokens.admin });
    await expect(requireHost(ctx, t)).resolves.toEqual({ role: "host", userId: null });
  });

  it("requireHost refuses anonymous visitors with UNAUTHENTICATED", async () => {
    const { t } = await setup();
    expect(await errorCode(requireHost(context(), t))).toBe("UNAUTHENTICATED");
  });

  it("requireHost refuses other users and player links with FORBIDDEN", async () => {
    const { other, t, tokens } = await setup();
    expect(await errorCode(requireHost(context({}, other.id), t))).toBe("FORBIDDEN");
    const playerCtx = context({ [accessCookieName("player", t.slug)]: tokens.player });
    expect(await errorCode(requireHost(playerCtx, t))).toBe("FORBIDDEN");
  });

  it("requireHost refuses a forged admin cookie", async () => {
    const { t } = await setup();
    const ctx = context({ [accessCookieName("admin", t.slug)]: "forged" });
    expect(await errorCode(requireHost(ctx, t))).toBe("UNAUTHENTICATED");
  });

  it("requireScorer lets the host score", async () => {
    const { owner, t } = await setup();
    await expect(requireScorer(context({}, owner.id), t)).resolves.toMatchObject({ role: "host" });
  });

  it("requireScorer accepts a player link with a chosen identity", async () => {
    const { t, tokens, andi } = await setup();
    const ctx = context({
      [accessCookieName("player", t.slug)]: tokens.player,
      [identityCookieName(t.slug)]: andi.id,
    });
    await expect(requireScorer(ctx, t)).resolves.toEqual({ role: "player", playerId: andi.id });
  });

  it("requireScorer asks a player to choose who they are first", async () => {
    const { t, tokens } = await setup();
    const ctx = context({ [accessCookieName("player", t.slug)]: tokens.player });
    expect(await errorCode(requireScorer(ctx, t))).toBe("FORBIDDEN");
  });

  it("requireScorer refuses a withdrawn or foreign identity", async () => {
    const { t, tokens, budi } = await setup();
    const link = { [accessCookieName("player", t.slug)]: tokens.player };
    const withdrawn = context({ ...link, [identityCookieName(t.slug)]: budi.id });
    expect(await errorCode(requireScorer(withdrawn, t))).toBe("FORBIDDEN");
    const other = await createTournament("zzz000");
    const [stranger] = await db
      .insert(players)
      .values({ tournamentId: other.id, name: "X", position: 0 })
      .returning();
    const foreign = context({ ...link, [identityCookieName(t.slug)]: stranger!.id });
    expect(await errorCode(requireScorer(foreign, t))).toBe("FORBIDDEN");
  });

  it("requireScorer refuses a tampered identity cookie without a server error", async () => {
    const { t, tokens } = await setup();
    const ctx = context({
      [accessCookieName("player", t.slug)]: tokens.player,
      [identityCookieName(t.slug)]: "not-a-uuid'; drop table players;--",
    });
    expect(await errorCode(requireScorer(ctx, t))).toBe("FORBIDDEN");
  });

  it("requireScorer refuses anonymous visitors", async () => {
    const { t } = await setup();
    expect(await errorCode(requireScorer(context(), t))).toBe("UNAUTHENTICATED");
  });

  it("requireViewer finds a live tournament by slug", async () => {
    const { t } = await setup();
    await expect(requireViewer(db, "abc123")).resolves.toMatchObject({ id: t.id, slug: "abc123" });
  });

  it("requireViewer hides unknown and expired tournaments as NOT_FOUND", async () => {
    await createTournament("old999", { expiresAt: new Date(Date.now() - 60 * 60 * 1000) });
    expect(await errorCode(requireViewer(db, "nope00"))).toBe("NOT_FOUND");
    expect(await errorCode(requireViewer(db, "old999"))).toBe("NOT_FOUND");
  });
});
