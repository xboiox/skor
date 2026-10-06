import { ok } from "@/lib/api-response";
import { hostEditSchema } from "@/lib/validation/match";
import { getEnv } from "@/server/env";
import { loadMatchAccess, readJson } from "@/server/http/request-context";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOriginJson } from "@/server/http/same-origin";
import { editMatchScore } from "@/server/matches/host-actions";

export const dynamic = "force-dynamic";

/** Host correction of a result; counts as approved. */
export const PATCH = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/matches/[id]">) => {
    assertSameOriginJson(request, getEnv().APP_URL);
    const body = hostEditSchema.parse(await readJson(request));
    const { ctx, matchId, actor } = await loadMatchAccess((await params).id, "host");
    return ok(await editMatchScore(ctx.db, { matchId, actor, ...body }));
  },
);
