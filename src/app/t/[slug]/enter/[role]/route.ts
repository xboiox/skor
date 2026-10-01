import { NextResponse, type NextRequest } from "next/server";
import { exchangeAccessLink } from "@/server/access/exchange";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { withErrorHandling } from "@/server/http/route-handler";

export const dynamic = "force-dynamic";

const INVALID_LINK_HTML = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link not valid · Skor</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1>This link is not valid</h1>
<p>It may be mistyped, replaced by a newer link, or the tournament has expired (guest tournaments are kept for 7 days).</p>
<p><a href="/">Go to Skor</a></p></body>`;

export const GET = withErrorHandling(
  async (request: NextRequest, { params }: RouteContext<"/t/[slug]/enter/[role]">) => {
    const { slug, role } = await params;
    const exchange = await exchangeAccessLink(getDb(), {
      slug,
      role,
      token: request.nextUrl.searchParams.get("k") ?? "",
      isSecure: getEnv().APP_URL.startsWith("https://"),
    });

    if (!exchange) {
      return new Response(INVALID_LINK_HTML, {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8", "referrer-policy": "no-referrer" },
      });
    }

    const response = NextResponse.redirect(new URL(exchange.redirectTo, request.url), 303);
    response.cookies.set(exchange.cookie.name, exchange.cookie.value, exchange.cookie.options);
    response.headers.set("referrer-policy", "no-referrer");
    return response;
  },
);
