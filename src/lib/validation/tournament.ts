import { z } from "zod";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 100;
export const MIN_COURTS = 1;
export const MAX_COURTS = 20;
export const RALLY_POINT_OPTIONS = [16, 21, 24, 32] as const;
export const TENNIS_GAMES_PRESETS = [4, 6] as const;
export const TENNIS_GAMES_MIN = 1;
export const TENNIS_GAMES_MAX = 12;
const MAX_NAME_LENGTH = 100;
const MAX_PLAYER_NAME_LENGTH = 50;

const normalizeSpaces = (value: string) => value.trim().replace(/\s+/g, " ");

export const playerNameSchema = z
  .string()
  .transform(normalizeSpaces)
  .pipe(
    z.string().min(1, "Enter a name").max(MAX_PLAYER_NAME_LENGTH, "Keep names under 50 characters"),
  );

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const isoDateSchema = z.string().refine(isValidIsoDate, "Use a valid date like 2026-10-03");

export const scoringSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rally"), totalPoints: z.literal(RALLY_POINT_OPTIONS) }),
  z.object({
    type: z.literal("tennis"),
    mode: z.enum(["first_to", "total_of"]),
    games: z.number().int().min(TENNIS_GAMES_MIN).max(TENNIS_GAMES_MAX),
    deuce: z.enum(["golden_point", "advantage"]),
  }),
]);

export const createTournamentSchema = z.object({
  name: z
    .string()
    .transform(normalizeSpaces)
    .pipe(z.string().min(1, "Enter a name").max(MAX_NAME_LENGTH)),
  date: isoDateSchema,
  matchType: z.enum(["americano", "mexicano"]),
  courts: z.number().int().min(MIN_COURTS).max(MAX_COURTS),
  scoring: scoringSchema,
  players: z
    .array(playerNameSchema)
    .min(MIN_PLAYERS, `Add at least ${MIN_PLAYERS} players`)
    .max(MAX_PLAYERS, `At most ${MAX_PLAYERS} players`)
    .refine(
      (names) => new Set(names.map((n) => n.toLowerCase())).size === names.length,
      "Each player name must be unique",
    ),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type ScoringInput = z.infer<typeof scoringSchema>;

const LIST_MARKER = /^(?:[-*•]|\d+[.)])\s*/;

/** Turns a pasted list (one per line or comma separated, numbered or bulleted) into unique names. */
export function parsePlayerList(text: string): string[] {
  const names = text
    .split(/[\n,;]/)
    .map((line) => normalizeSpaces(line.trim().replace(LIST_MARKER, "")))
    .filter((name) => name.length > 0);
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
