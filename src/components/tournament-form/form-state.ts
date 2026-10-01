import {
  createTournamentSchema,
  parsePlayerList,
  type CreateTournamentInput,
} from "@/lib/validation/tournament";

export type FormState = {
  readonly name: string;
  readonly date: string;
  readonly matchType: "americano" | "mexicano";
  readonly courts: number;
  readonly scoringType: "rally" | "tennis";
  readonly totalPoints: 16 | 21 | 24 | 32;
  readonly tennisMode: "first_to" | "total_of";
  readonly tennisGames: number;
  readonly deuce: "golden_point" | "advantage";
  readonly players: readonly string[];
};

export const STEPS = ["Details", "Format", "Players", "Review"] as const;
const REVIEW_STEP = 3;

/** Which top-level fields each step is responsible for. */
const STEP_FIELDS: Record<number, readonly string[]> = {
  0: ["name", "date"],
  1: ["matchType", "courts", "scoring"],
  2: ["players"],
};

export function initialFormState(today: string): FormState {
  return {
    name: "",
    date: today,
    matchType: "americano",
    courts: 2,
    scoringType: "rally",
    totalPoints: 24,
    tennisMode: "first_to",
    tennisGames: 6,
    deuce: "golden_point",
    players: [],
  };
}

export function toCreateInput(state: FormState): CreateTournamentInput {
  return {
    name: state.name,
    date: state.date,
    matchType: state.matchType,
    courts: state.courts,
    scoring:
      state.scoringType === "rally"
        ? { type: "rally", totalPoints: state.totalPoints }
        : { type: "tennis", mode: state.tennisMode, games: state.tennisGames, deuce: state.deuce },
    players: [...state.players],
  };
}

/** Field errors for one step (keyed by path, e.g. "name" or "scoring.games"). The review step checks everything. */
export function stepErrors(state: FormState, step: number): Record<string, string> {
  const result = createTournamentSchema.safeParse(toCreateInput(state));
  if (result.success) return {};

  const fields = STEP_FIELDS[step];
  return result.error.issues.reduce<Record<string, string>>((errors, issue) => {
    const [field] = issue.path.map(String);
    if (!field || (step !== REVIEW_STEP && !fields?.includes(field))) return errors;
    const key = field === "players" ? "players" : issue.path.join(".");
    return key in errors ? errors : { ...errors, [key]: issue.message };
  }, {});
}

export function addPlayers(
  existing: readonly string[],
  text: string,
): { players: string[]; skipped: string[] } {
  const known = new Set(existing.map((name) => name.toLowerCase()));
  const incoming = parsePlayerList(text);
  return {
    players: [...existing, ...incoming.filter((name) => !known.has(name.toLowerCase()))],
    skipped: incoming.filter((name) => known.has(name.toLowerCase())),
  };
}

export function removePlayer(players: readonly string[], index: number): string[] {
  return players.filter((_, i) => i !== index);
}
