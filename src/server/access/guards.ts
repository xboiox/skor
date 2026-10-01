import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/api-response";
import type { Database } from "@/server/db/client";
import { players } from "@/server/db/schema";
import { findLiveTournamentBySlug, type TournamentRef } from "@/server/tournaments/repository";
import { verifyAccessToken } from "./access-repository";
import { accessCookieName, identityCookieName, type AccessRole } from "./tokens";

const playerIdSchema = z.uuid();

export type CookieReader = { get(name: string): { value: string } | undefined };

export type AccessContext = {
  readonly db: Database;
  readonly cookies: CookieReader;
  /** Signed-in Better Auth user, if any. */
  readonly userId: string | null;
};

type GuardTournament = Pick<TournamentRef, "id" | "slug" | "ownerId">;

export type HostAccess = { readonly role: "host"; readonly userId: string | null };
export type PlayerAccess = { readonly role: "player"; readonly playerId: string };

async function hasValidCookie(
  ctx: AccessContext,
  t: GuardTournament,
  role: AccessRole,
): Promise<boolean> {
  const token = ctx.cookies.get(accessCookieName(role, t.slug))?.value;
  if (!token) return false;
  const match = await verifyAccessToken(ctx.db, t.slug, role, token);
  return match?.id === t.id;
}

async function findHost(ctx: AccessContext, t: GuardTournament): Promise<HostAccess | null> {
  if (ctx.userId && t.ownerId === ctx.userId) return { role: "host", userId: ctx.userId };
  if (await hasValidCookie(ctx, t, "admin")) return { role: "host", userId: ctx.userId };
  return null;
}

/** Anonymous visitors get UNAUTHENTICATED; known users or players without host rights get FORBIDDEN. */
function denied(ctx: AccessContext, hasPlayerLink: boolean, message: string): AppError {
  return ctx.userId || hasPlayerLink
    ? new AppError("FORBIDDEN", message)
    : new AppError("UNAUTHENTICATED", "Open the link you were given or sign in.");
}

export async function requireHost(ctx: AccessContext, t: GuardTournament): Promise<HostAccess> {
  const host = await findHost(ctx, t);
  if (host) return host;
  throw denied(ctx, await hasValidCookie(ctx, t, "player"), "Only the host can do this.");
}

/** Host, or a player link holder who has chosen an active player in this tournament. */
export async function requireScorer(
  ctx: AccessContext,
  t: GuardTournament,
): Promise<HostAccess | PlayerAccess> {
  const host = await findHost(ctx, t);
  if (host) return host;

  const hasPlayerLink = await hasValidCookie(ctx, t, "player");
  if (!hasPlayerLink) throw denied(ctx, false, "Only players in this tournament can enter scores.");

  // Cookies are user-controlled: validate the shape before it reaches a uuid column.
  const parsed = playerIdSchema.safeParse(ctx.cookies.get(identityCookieName(t.slug))?.value);
  if (!parsed.success) throw new AppError("FORBIDDEN", "Choose who you are first.");
  const playerId = parsed.data;

  const [player] = await ctx.db
    .select({ id: players.id })
    .from(players)
    .where(
      and(eq(players.id, playerId), eq(players.tournamentId, t.id), eq(players.status, "active")),
    )
    .limit(1);
  if (!player) throw new AppError("FORBIDDEN", "Choose who you are first.");

  return { role: "player", playerId: player.id };
}

export async function requireViewer(db: Database, slug: string): Promise<TournamentRef> {
  const tournament = await findLiveTournamentBySlug(db, slug);
  if (!tournament)
    throw new AppError(
      "NOT_FOUND",
      "Tournament not found. Guest tournaments are removed after 7 days.",
    );
  return tournament;
}
