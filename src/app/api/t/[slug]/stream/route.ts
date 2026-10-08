import { requireViewer } from "@/server/access/guards";
import { getDb } from "@/server/db/client";
import { withErrorHandling } from "@/server/http/route-handler";
import { formatSse } from "@/server/realtime/events";
import { getHub } from "@/server/realtime/hub";

export const dynamic = "force-dynamic";
// Serverless hosts (Vercel) end the stream after this; EventSource reconnects and resyncs.
// 300 s is the Vercel Hobby maximum. Ignored by `next start` on a VPS.
export const maxDuration = 300;

const HEARTBEAT_MS = 25_000;
const RETRY_MS = 3_000;

/**
 * Server-sent events for one tournament. Public like the leaderboard: anyone with the slug may
 * follow along. Each event is small; clients refetch or apply the included match state.
 */
export const GET = withErrorHandling(
  async (request: Request, { params }: RouteContext<"/api/t/[slug]/stream">) => {
    const tournament = await requireViewer(getDb(), (await params).slug);
    const encoder = new TextEncoder();
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let isClosed = false;
        const send = (text: string) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            cleanup(); // the client went away between checks
          }
        };

        send(`retry: ${RETRY_MS}\n\n`);

        const unsubscribe = await getHub().subscribe(tournament.id, (event) =>
          send(formatSse(event.type, event)),
        );

        // Only after LISTEN is active, so "ready" means no later change can be missed.

        send(formatSse("ready", { tournamentId: tournament.id }));
        const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

        cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed by the runtime
          }
        };
        if (request.signal.aborted) cleanup();
        else request.signal.addEventListener("abort", () => cleanup(), { once: true });
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no", // disable proxy buffering (nginx)
      },
    });
  },
);
