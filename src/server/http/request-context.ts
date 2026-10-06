import { cookies } from "next/headers";
import { z } from "zod";
import { AppError } from "@/lib/api-response";
import type { AccessContext } from "@/server/access/guards";
import {
  requireHost,
  requireScorer,
  type HostAccess,
  type PlayerAccess,
} from "@/server/access/guards";
import { getCurrentSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { eq } from "drizzle-orm";
import { matches } from "@/server/db/schema";
import type { Actor } from "@/server/matches/match-store";
import { findLiveTournamentById, type TournamentRef } from "@/server/tournaments/repository";

const uuidSchema = z.uuid();

export async function getAccessContext(): Promise<AccessContext> {
  const [cookieStore, session] = await Promise.all([cookies(), getCurrentSession()]);
  return { db: getDb(), cookies: cookieStore, userId: session?.user.id ?? null };
}

/** Path ids are user input: anything that is not a UUID is simply "not found". */
export function parseId(value: string, what = "Tournament"): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new AppError("NOT_FOUND", `${what} not found.`);
  return parsed.data;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "The request body is not valid JSON.");
  }
}

/** Loads a live tournament by id and checks the caller is its host. */
export async function loadHostTournament(
  rawId: string,
): Promise<{ ctx: AccessContext; tournament: TournamentRef; host: HostAccess }> {
  const ctx = await getAccessContext();
  const tournament = await findLiveTournamentById(ctx.db, parseId(rawId));
  if (!tournament) throw new AppError("NOT_FOUND", "Tournament not found.");
  const host = await requireHost(ctx, tournament);
  return { ctx, tournament, host };
}

export function actorOf(access: HostAccess | PlayerAccess): Actor {
  return access.role === "host"
    ? { role: "host", userId: access.userId }
    : { role: "player", playerId: access.playerId };
}

/** Loads the match's tournament and checks the caller may act on it (`scorer` or `host`). */
export async function loadMatchAccess(rawMatchId: string, level: "scorer" | "host") {
  const ctx = await getAccessContext();
  const matchId = parseId(rawMatchId, "Match");
  const [match] = await ctx.db
    .select({ tournamentId: matches.tournamentId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  const tournament = match ? await findLiveTournamentById(ctx.db, match.tournamentId) : null;
  if (!tournament) throw new AppError("NOT_FOUND", "Match not found.");
  const access =
    level === "host" ? await requireHost(ctx, tournament) : await requireScorer(ctx, tournament);
  return { ctx, matchId, actor: actorOf(access) };
}
