import { cookies } from "next/headers";
import { z } from "zod";
import { AppError } from "@/lib/api-response";
import type { AccessContext } from "@/server/access/guards";
import { requireHost, type HostAccess } from "@/server/access/guards";
import { getCurrentSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
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
