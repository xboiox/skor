import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/api-response";
import { identitySchema } from "@/lib/validation/match";
import { requireViewer } from "@/server/access/guards";
import { chooseIdentity } from "@/server/access/identity";
import { identityCookieName } from "@/server/access/tokens";
import { getEnv } from "@/server/env";
import { getAccessContext, readJson } from "@/server/http/request-context";
import { enforceRateLimit, RATE_LIMITS, requestIp } from "@/server/http/rate-limits";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOrigin, assertSameOriginJson } from "@/server/http/same-origin";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/t/[slug]/identity">) => {
    const { APP_URL } = getEnv();
    assertSameOriginJson(request, APP_URL);
    const { playerId } = identitySchema.parse(await readJson(request));
    const ctx = await getAccessContext();
    const tournament = await requireViewer(ctx.db, (await params).slug);
    enforceRateLimit(
      `identity:${tournament.id}:${requestIp(request) ?? "unknown"}`,
      RATE_LIMITS.identity,
    );
    const { player, cookie } = await chooseIdentity(
      ctx,
      tournament,
      playerId,
      APP_URL.startsWith("https://"),
    );

    const body: ApiResponse<typeof player> = { success: true, data: player, error: null };
    const response = NextResponse.json(body);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  },
);

/** "Not you?" — forget the chosen player on this device. */
export const DELETE = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/t/[slug]/identity">) => {
    assertSameOrigin(request, getEnv().APP_URL);
    const response = NextResponse.json({ success: true, data: { cleared: true }, error: null });
    response.cookies.delete(identityCookieName((await params).slug));
    return response;
  },
);
