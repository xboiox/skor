import { timingSafeEqual } from "node:crypto";
import { AppError, ok } from "@/lib/api-response";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { withErrorHandling } from "@/server/http/route-handler";
import { deleteExpiredTournaments } from "@/server/tournaments/cleanup";

export const dynamic = "force-dynamic";

function isAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Vercel Cron (see vercel.json) — on a VPS the `cleanup` container does this job instead. */
export const GET = withErrorHandling(async (request: Request) => {
  if (!isAuthorized(request.headers.get("authorization"), getEnv().CRON_SECRET)) {
    throw new AppError("UNAUTHENTICATED", "Unauthorized.");
  }
  const deleted = await deleteExpiredTournaments(getDb());
  logger.info("Guest cleanup finished", { deleted });
  return ok({ deleted });
});
