import { ok } from "@/lib/api-response";
import { getSql } from "@/server/db/client";
import { withErrorHandling } from "@/server/http/route-handler";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  await getSql()`select 1`;
  return ok({ status: "ok", database: "up" });
});
