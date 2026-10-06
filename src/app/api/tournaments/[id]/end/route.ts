import { ok } from "@/lib/api-response";
import { getEnv } from "@/server/env";
import { loadHostTournament } from "@/server/http/request-context";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOrigin } from "@/server/http/same-origin";
import { endTournament } from "@/server/tournaments/flow";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/tournaments/[id]/end">) => {
    assertSameOrigin(request, getEnv().APP_URL);
    const { ctx, tournament } = await loadHostTournament((await params).id);
    return ok((await endTournament(ctx.db, tournament.id)) ?? { done: true });
  },
);
