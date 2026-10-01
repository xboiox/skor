import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { tournaments } from "@/server/db/schema";

export type TournamentRef = {
  readonly id: string;
  readonly slug: string;
  readonly ownerId: string | null;
  readonly expiresAt: Date | null;
};

/** Live = exists and not past its guest expiry (cleanup may not have deleted it yet). */
export function isLive(now: Date = new Date()) {
  return or(isNull(tournaments.expiresAt), gt(tournaments.expiresAt, now));
}

export async function findLiveTournamentBySlug(
  db: Database,
  slug: string,
): Promise<TournamentRef | null> {
  const [row] = await db
    .select({
      id: tournaments.id,
      slug: tournaments.slug,
      ownerId: tournaments.ownerId,
      expiresAt: tournaments.expiresAt,
    })
    .from(tournaments)
    .where(and(eq(tournaments.slug, slug), isLive()))
    .limit(1);
  return row ?? null;
}

export async function findLiveTournamentById(
  db: Database,
  id: string,
): Promise<TournamentRef | null> {
  const [row] = await db
    .select({
      id: tournaments.id,
      slug: tournaments.slug,
      ownerId: tournaments.ownerId,
      expiresAt: tournaments.expiresAt,
    })
    .from(tournaments)
    .where(and(eq(tournaments.id, id), isLive()))
    .limit(1);
  return row ?? null;
}
