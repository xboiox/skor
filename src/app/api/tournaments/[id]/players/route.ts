import { z } from "zod";
import { ok } from "@/lib/api-response";
import { getEnv } from "@/server/env";
import { loadHostTournament, readJson } from "@/server/http/request-context";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOriginJson } from "@/server/http/same-origin";
import { addPlayer } from "@/server/tournaments/players";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ name: z.string() });

export const POST = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/tournaments/[id]/players">) => {
    assertSameOriginJson(request, getEnv().APP_URL);
    const { id } = await params;
    const { ctx, tournament } = await loadHostTournament(id);
    const { name } = bodySchema.parse(await readJson(request));
    return ok(await addPlayer(ctx.db, tournament.id, name), 201);
  },
);
