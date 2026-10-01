import type { DeuceRule, Team } from "./types";

/** Raw points inside one tennis game: 0, 1, 2, 3 = "0", "15", "30", "40". */
export type GamePoints = { readonly a: number; readonly b: number };

export type GamePhase = "normal" | "deuce" | "advantage" | "golden_point";

export type GamePointDisplay = {
  readonly a: string;
  readonly b: string;
  readonly phase: GamePhase;
};

export type GamePointResult = { readonly state: GamePoints; readonly winner: Team | null };

const FORTY = 3;
const MIN_POINTS_TO_WIN = 4;
const POINT_LABELS = ["0", "15", "30", "40"] as const;
const LEAD_TO_WIN: Record<DeuceRule, number> = { golden_point: 1, advantage: 2 };

function gameWinner(rule: DeuceRule, a: number, b: number): Team | null {
  const lead = LEAD_TO_WIN[rule];
  if (a >= MIN_POINTS_TO_WIN && a - b >= lead) return "A";
  if (b >= MIN_POINTS_TO_WIN && b - a >= lead) return "B";
  return null;
}

/** Applies one point to the current game. Deuce is normalised back to 3-3 so values stay small. */
export function winGamePoint(rule: DeuceRule, state: GamePoints, team: Team): GamePointResult {
  const a = state.a + (team === "A" ? 1 : 0);
  const b = state.b + (team === "B" ? 1 : 0);

  const winner = gameWinner(rule, a, b);
  if (winner) return { state: { a: 0, b: 0 }, winner };
  if (a >= FORTY && a === b) return { state: { a: FORTY, b: FORTY }, winner: null };
  return { state: { a, b }, winner: null };
}

export function formatGamePoint(rule: DeuceRule, state: GamePoints): GamePointDisplay {
  const { a, b } = state;
  if (a >= FORTY && b >= FORTY) {
    if (a === b)
      return { a: "40", b: "40", phase: rule === "golden_point" ? "golden_point" : "deuce" };
    return a > b
      ? { a: "AD", b: "40", phase: "advantage" }
      : { a: "40", b: "AD", phase: "advantage" };
  }
  return { a: POINT_LABELS[a] ?? "40", b: POINT_LABELS[b] ?? "40", phase: "normal" };
}
