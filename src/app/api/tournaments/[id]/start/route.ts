import { ok } from "@/lib/api-response";
import { getEnv } from "@/server/env";
import { loadHostTournament } from "@/server/http/request-context";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOrigin } from "@/server/http/same-origin";
import { startTournament } from "@/server/tournaments/start";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/tournaments/[id]/start">) => {
    assertSameOrigin(request, getEnv().APP_URL);
    const { id } = await params;
    const { ctx, tournament } = await loadHostTournament(id);
    await startTournament(ctx.db, tournament.id);
    return ok({ status: "active" });
  },
);
