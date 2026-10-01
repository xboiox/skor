import { describe, expect, it } from "vitest";
import { applyPoint, isComplete, statusForScore, validateFinal } from "./engine";
import {
  EMPTY_SCORE,
  RALLY_TOTAL_POINTS,
  type MatchScore,
  type ScoringConfig,
  type Team,
} from "./types";

// Deterministic LCG so failures are reproducible.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const CONFIGS: ScoringConfig[] = [
  ...RALLY_TOTAL_POINTS.map((totalPoints): ScoringConfig => ({ type: "rally", totalPoints })),
  ...[1, 4, 6, 12].flatMap((games) =>
    (["first_to", "total_of"] as const).flatMap((mode) =>
      (["golden_point", "advantage"] as const).map((deuce): ScoringConfig => ({
        type: "tennis",
        mode,
        games,
        deuce,
      })),
    ),
  ),
];

const MATCHES_PER_CONFIG = 50;
const SAFETY_LIMIT = 10_000;

function playRandomMatch(
  config: ScoringConfig,
  random: () => number,
): { final: MatchScore; points: number } {
  let current = EMPTY_SCORE;
  let points = 0;
  while (!isComplete(config, current)) {
    const team: Team = random() < 0.5 ? "A" : "B";
    const result = applyPoint(config, current, team);
    if (!result.ok) throw new Error(`unexpected error: ${result.error.message}`);
    current = result.value;
    points += 1;
    expect(current.gameA).toBeLessThanOrEqual(4);
    expect(current.gameB).toBeLessThanOrEqual(4);
    expect(statusForScore(config, current)).toBe(
      isComplete(config, current) ? "submitted" : "in_progress",
    );
    if (points > SAFETY_LIMIT) throw new Error("match never completes");
  }
  return { final: current, points };
}

describe.each(CONFIGS.map((c) => [JSON.stringify(c), c] as const))(
  "invariants for %s",
  (_, config) => {
    it("every random match completes on an exact, valid final score", () => {
      const random = seededRandom(2026);
      for (let i = 0; i < MATCHES_PER_CONFIG; i += 1) {
        const { final, points } = playRandomMatch(config, random);

        // The live result is always accepted by the final-result validator.
        expect(validateFinal(config, final.scoreA, final.scoreB)).toEqual({
          ok: true,
          value: { ...final, gameA: 0, gameB: 0 },
        });
        expect(final.gameA + final.gameB).toBe(0);
        expect(applyPoint(config, final, "A").ok).toBe(false);

        if (config.type === "rally") expect(points).toBe(config.totalPoints);
      }
    });
  },
);
