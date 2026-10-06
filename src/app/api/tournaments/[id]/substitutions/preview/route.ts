import { ok } from "@/lib/api-response";
import { substitutionSchema } from "@/lib/validation/match";
import { getEnv } from "@/server/env";
import { loadHostTournament, readJson } from "@/server/http/request-context";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOriginJson } from "@/server/http/same-origin";
import { substitutePlayer } from "@/server/tournaments/substitute";

export const dynamic = "force-dynamic";

/** Shows which matches a substitution would change, without saving anything. */
export const POST = withErrorHandling(
  async (
    request: Request,
    { params }: RouteContext<"/api/tournaments/[id]/substitutions/preview">,
  ) => {
    assertSameOriginJson(request, getEnv().APP_URL);
    const body = substitutionSchema.parse(await readJson(request));
    const { ctx, tournament } = await loadHostTournament((await params).id);
    return ok(await substitutePlayer(ctx.db, tournament.id, body, { dryRun: true }));
  },
);
