import { expect } from "vitest";
import type { PlannedRound, PlayerId } from "./types";

export function players(count: number): PlayerId[] {
  return Array.from({ length: count }, (_, i) => `p${String(i + 1).padStart(2, "0")}`);
}

export function pairKey(a: PlayerId, b: PlayerId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Every player appears exactly once per round (in a match or on a bye); courts are 1..m. */
export function expectValidRound(round: PlannedRound, playerIds: readonly PlayerId[]): void {
  const seen = [...round.matches.flatMap((m) => [...m.teamA, ...m.teamB]), ...round.byes];
  expect([...seen].sort()).toEqual([...playerIds].sort());
  expect(round.matches.map((m) => m.court)).toEqual(round.matches.map((_, i) => i + 1));
}

export function partnerCounts(rounds: readonly PlannedRound[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of rounds.flatMap((r) => r.matches)) {
    for (const [a, b] of [match.teamA, match.teamB]) {
      const key = pairKey(a, b);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export function byeCounts(
  rounds: readonly PlannedRound[],
  playerIds: readonly PlayerId[],
): number[] {
  return playerIds.map((id) => rounds.filter((r) => r.byes.includes(id)).length);
}
