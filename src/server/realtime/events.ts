import { z } from "zod";
import type { MatchView } from "@/server/matches/view";

export const CHANNEL = "tournament_events";

export type TournamentEvent =
  | { readonly tournamentId: string; readonly type: "tournament.updated" }
  | { readonly tournamentId: string; readonly type: "match.updated"; readonly match: MatchView };

const eventSchema = z.discriminatedUnion("type", [
  z.object({ tournamentId: z.uuid(), type: z.literal("tournament.updated") }),
  z.object({
    tournamentId: z.uuid(),
    type: z.literal("match.updated"),
    match: z.looseObject({ id: z.uuid(), version: z.number().int() }),
  }),
]);

/** NOTIFY payloads come from outside this process: validate and never throw. */
export function parseEvent(payload: string): TournamentEvent | null {
  try {
    const parsed = eventSchema.safeParse(JSON.parse(payload));
    return parsed.success ? (parsed.data as TournamentEvent) : null;
  } catch {
    return null;
  }
}

export function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
