import { sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { CHANNEL, type TournamentEvent } from "./events";

/**
 * Queues a realtime event inside the caller's transaction. Postgres delivers NOTIFY only after
 * commit, so clients never hear about changes that were rolled back.
 */
export async function notifyTournament(db: Executor, event: TournamentEvent): Promise<void> {
  await db.execute(sql`select pg_notify(${CHANNEL}, ${JSON.stringify(event)})`);
}
