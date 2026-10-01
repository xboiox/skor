import { ok } from "@/lib/api-response";
import { getEnv } from "@/server/env";
import { loadHostTournament, parseId } from "@/server/http/request-context";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOrigin } from "@/server/http/same-origin";
import { removePlayer } from "@/server/tournaments/players";

export const dynamic = "force-dynamic";

export const DELETE = withErrorHandling(
  async (
    request: Request,
    { params }: RouteContext<"/api/tournaments/[id]/players/[playerId]">,
  ) => {
    assertSameOrigin(request, getEnv().APP_URL);
    const { id, playerId } = await params;
    const { ctx, tournament } = await loadHostTournament(id);
    await removePlayer(ctx.db, tournament.id, parseId(playerId, "Player"));
    return ok({ removed: true });
  },
);
