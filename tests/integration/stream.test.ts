import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/t/[slug]/stream/route";
import { getSql } from "@/server/db/client";
import { getHub } from "@/server/realtime/hub";
import { createTournament } from "@/server/tournaments/create";
import { endTournament } from "@/server/tournaments/flow";
import { startTournament } from "@/server/tournaments/start";
import { connectTestDb, TEST_DATABASE_URL, truncateAll } from "./test-db";

process.env.DATABASE_URL = TEST_DATABASE_URL;
const { sql, db } = connectTestDb();
const decoder = new TextDecoder();

async function started() {
  const { tournament } = await createTournament(
    db,
    {
      name: "Stream",
      date: "2026-10-03",
      matchType: "mexicano",
      courts: 1,
      scoring: { type: "rally", totalPoints: 16 },
      players: ["A", "B", "C", "D"],
    },
    { ownerId: null, guestTtlDays: 7 },
  );
  await startTournament(db, tournament.id);
  return tournament;
}

function open(slug: string) {
  const abort = new AbortController();
  const response = GET(
    new Request(`http://localhost:3000/api/t/${slug}/stream`, { signal: abort.signal }),
    {
      params: Promise.resolve({ slug }),
    },
  );
  return { abort, response };
}

/** Reads the stream until `needle` appears (or fails after a few seconds). */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  needle: string,
): Promise<string> {
  let text = "";
  const deadline = Date.now() + 3000;
  while (!text.includes(needle)) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${needle}; got: ${text}`);
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  return text;
}

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await getHub().close();
  await sql.end();
  await getSql().end();
});

describe("GET /api/t/:slug/stream", () => {
  it("streams server-sent events for the tournament", async () => {
    const tournament = await started();
    const { abort, response } = open(tournament.slug);
    const res = await response;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");

    const reader = res.body!.getReader();
    expect(await readUntil(reader, "event: ready")).toContain("retry: 3000");

    await endTournament(db, tournament.id);
    const text = await readUntil(reader, "event: tournament.updated");
    expect(text).toContain(`"tournamentId":"${tournament.id}"`);
    abort.abort();
  });

  it("releases the hub subscription when the client disconnects", async () => {
    const tournament = await started();
    const before = getHub().subscriberCount();
    const { abort, response } = open(tournament.slug);
    const reader = (await response).body!.getReader();
    await readUntil(reader, "event: ready");
    expect(getHub().subscriberCount()).toBe(before + 1);

    abort.abort();
    await new Promise((r) => setTimeout(r, 50));
    expect(getHub().subscriberCount()).toBe(before);
  });

  it("returns 404 for an unknown tournament", async () => {
    const res = await open("nope00").response;
    expect(res.status).toBe(404);
  });
});
