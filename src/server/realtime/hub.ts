import type postgres from "postgres";
import { getListenSql } from "@/server/db/client";
import { logger } from "@/server/logger";
import { CHANNEL, parseEvent, type TournamentEvent } from "./events";

type Listener = (event: TournamentEvent) => void;

/**
 * One LISTEN connection per server process, fanned out to SSE subscribers by tournament.
 * postgres.js re-establishes the LISTEN after a dropped connection on its own.
 */
export class RealtimeHub {
  private readonly listeners = new Map<string, Set<Listener>>();
  private listening: Promise<postgres.ListenMeta> | null = null;

  constructor(private readonly sql: () => postgres.Sql) {}

  async subscribe(tournamentId: string, listener: Listener): Promise<() => void> {
    const set = this.listeners.get(tournamentId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(tournamentId, set);
    await this.ensureListening();
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(tournamentId);
    };
  }

  subscriberCount(): number {
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }

  async close(): Promise<void> {
    const meta = await this.listening?.catch(() => null);
    this.listening = null;
    this.listeners.clear();
    await meta?.unlisten();
  }

  private ensureListening(): Promise<postgres.ListenMeta> {
    this.listening ??= this.sql()
      .listen(CHANNEL, (payload) => this.dispatch(payload))
      .catch((error: unknown) => {
        this.listening = null; // allow the next subscriber to retry
        throw error;
      });
    return this.listening;
  }

  private dispatch(payload: string): void {
    const event = parseEvent(payload);
    if (!event) {
      logger.warn("Ignored malformed realtime event", { payload: payload.slice(0, 200) });
      return;
    }
    for (const listener of this.listeners.get(event.tournamentId) ?? []) {
      try {
        listener(event);
      } catch (error) {
        logger.error("Realtime listener failed", { error, tournamentId: event.tournamentId });
      }
    }
  }
}

// Survives hot reloads so we never hold more than one LISTEN connection per process.
const globalForHub = globalThis as unknown as { skorHub?: RealtimeHub };

export function getHub(): RealtimeHub {
  globalForHub.skorHub ??= new RealtimeHub(getListenSql);
  return globalForHub.skorHub;
}
