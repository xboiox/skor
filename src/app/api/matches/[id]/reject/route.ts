import { ok } from "@/lib/api-response";
import { versionSchema } from "@/lib/validation/match";
import { getEnv } from "@/server/env";
import { loadMatchAccess, readJson } from "@/server/http/request-context";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOriginJson } from "@/server/http/same-origin";
import { rejectMatch } from "@/server/matches/host-actions";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/matches/[id]/reject">) => {
    assertSameOriginJson(request, getEnv().APP_URL);
    const { expectedVersion } = versionSchema.parse(await readJson(request));
    const { ctx, matchId, actor } = await loadMatchAccess((await params).id, "host");
    return ok(await rejectMatch(ctx.db, { matchId, expectedVersion, actor }));
  },
);
