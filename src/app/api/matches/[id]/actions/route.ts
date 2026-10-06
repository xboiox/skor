import { ok } from "@/lib/api-response";
import { scoreActionSchema } from "@/lib/validation/match";
import { getEnv } from "@/server/env";
import { loadMatchAccess, readJson } from "@/server/http/request-context";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOriginJson } from "@/server/http/same-origin";
import { applyScoreAction } from "@/server/matches/score-actions";

export const dynamic = "force-dynamic";

/** Live scoring: a point, an undo or a final result. Players (with an identity) and the host. */
export const POST = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/matches/[id]/actions">) => {
    assertSameOriginJson(request, getEnv().APP_URL);
    const body = scoreActionSchema.parse(await readJson(request));
    const { ctx, matchId, actor } = await loadMatchAccess((await params).id, "scorer");
    return ok(await applyScoreAction(ctx.db, { matchId, actor, ...body }));
  },
);
