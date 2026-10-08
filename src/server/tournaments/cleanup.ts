import { and, isNotNull, lt } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { tournaments } from "@/server/db/schema";

/**
 * Deletes guest tournaments past their expiry (child rows go by ON DELETE CASCADE).
 * Same rule as scripts/cleanup.sql (VPS cleanup container); used by the Vercel cron route.
 */
export async function deleteExpiredTournaments(
  db: Database,
  now: Date = new Date(),
): Promise<number> {
  const deleted = await db
    .delete(tournaments)
    .where(and(isNotNull(tournaments.expiresAt), lt(tournaments.expiresAt, now)))
    .returning({ id: tournaments.id });
  return deleted.length;
}
