import { describe, expect, it } from "vitest";
import { applyPoint, isComplete, statusForScore, validateFinal } from "./engine";
import { EMPTY_SCORE, type MatchScore, type ScoringConfig, type Team } from "./types";

const RALLY_24: ScoringConfig = { type: "rally", totalPoints: 24 };
const RALLY_21: ScoringConfig = { type: "rally", totalPoints: 21 };
const FIRST_TO_4: ScoringConfig = {
  type: "tennis",
  mode: "first_to",
  games: 4,
  deuce: "golden_point",
};
const TOTAL_OF_6: ScoringConfig = {
  type: "tennis",
  mode: "total_of",
  games: 6,
  deuce: "advantage",
};

function score(scoreA: number, scoreB: number, gameA = 0, gameB = 0): MatchScore {
  return { scoreA, scoreB, gameA, gameB };
}

/** Applies points in order and returns the final score; fails the test on any error. */
function playPoints(
  config: ScoringConfig,
  teams: Team[],
  start: MatchScore = EMPTY_SCORE,
): MatchScore {
  return teams.reduce((current, team) => {
    const result = applyPoint(config, current, team);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }, start);
}

const repeat = (team: Team, times: number): Team[] => Array.from({ length: times }, () => team);
const winGame = (team: Team): Team[] => repeat(team, 4);

describe("rally scoring", () => {
  it("adds one point to the scoring team", () => {
    expect(playPoints(RALLY_24, ["A", "A", "B"])).toEqual(score(2, 1));
  });

  it("is not complete before the total is reached", () => {
    expect(isComplete(RALLY_24, score(12, 11))).toBe(false);
  });

  it("is complete when the points add up to the total", () => {
    expect(
      isComplete(RALLY_24, playPoints(RALLY_24, [...repeat("A", 13), ...repeat("B", 11)])),
    ).toBe(true);
  });

  it("refuses points after the match is complete", () => {
    const result = applyPoint(RALLY_24, score(12, 12), "A");
    expect(result).toEqual({
      ok: false,
      error: { code: "MATCH_COMPLETE", message: expect.any(String) },
    });
  });

  it("does not mutate the input score", () => {
    const input = Object.freeze(score(3, 4));
    applyPoint(RALLY_24, input, "A");
    expect(input).toEqual(score(3, 4));
  });
});

describe("tennis scoring", () => {
  it("tracks points inside the current game", () => {
    expect(playPoints(FIRST_TO_4, ["A", "B", "A"])).toEqual(score(0, 0, 2, 1));
  });

  it("awards a game and resets game points", () => {
    expect(playPoints(FIRST_TO_4, winGame("B"))).toEqual(score(0, 1));
  });

  it("first_to: completes when a team reaches X games", () => {
    const end = playPoints(FIRST_TO_4, [
      ...winGame("A"),
      ...winGame("A"),
      ...winGame("A"),
      ...winGame("B"),
      ...winGame("A"),
    ]);
    expect(end).toEqual(score(4, 1));
    expect(isComplete(FIRST_TO_4, end)).toBe(true);
  });

  it("first_to: is not complete at 3-3", () => {
    expect(isComplete(FIRST_TO_4, score(3, 3))).toBe(false);
  });

  it("total_of: completes when X games have been played, draws allowed", () => {
    expect(isComplete(TOTAL_OF_6, score(3, 3))).toBe(true);
    expect(isComplete(TOTAL_OF_6, score(4, 1))).toBe(false);
  });

  it("refuses points after the match is complete", () => {
    expect(applyPoint(FIRST_TO_4, score(4, 2), "B").ok).toBe(false);
  });

  it("uses the configured deuce rule", () => {
    const deuce: Team[] = ["A", "A", "A", "B", "B", "B"];
    expect(playPoints(FIRST_TO_4, [...deuce, "A"])).toEqual(score(1, 0)); // golden point
    expect(playPoints(TOTAL_OF_6, [...deuce, "A"])).toEqual(score(0, 0, 4, 3)); // advantage
  });
});

describe("statusForScore (A6: auto-submit when complete)", () => {
  it("is in_progress while the match is running", () => {
    expect(statusForScore(RALLY_24, score(10, 9))).toBe("in_progress");
  });

  it("is submitted once the match is complete", () => {
    expect(statusForScore(RALLY_24, score(14, 10))).toBe("submitted");
    expect(statusForScore(FIRST_TO_4, score(2, 4))).toBe("submitted");
  });
});

describe("validateFinal", () => {
  it.each([
    [RALLY_24, 13, 11],
    [RALLY_24, 12, 12],
    [RALLY_24, 24, 0],
    [RALLY_21, 11, 10],
    [FIRST_TO_4, 4, 3],
    [FIRST_TO_4, 0, 4],
    [TOTAL_OF_6, 3, 3],
    [TOTAL_OF_6, 6, 0],
  ])("accepts %o %i-%i", (config, a, b) => {
    expect(validateFinal(config, a, b)).toEqual({ ok: true, value: score(a, b) });
  });

  it.each([
    [RALLY_24, 13, 12, /add up to 24/],
    [RALLY_24, 12, 11, /add up to 24/],
    [RALLY_21, 10, 10, /add up to 21/],
    [FIRST_TO_4, 4, 4, /exactly one team/i],
    [FIRST_TO_4, 3, 2, /exactly one team/i],
    [FIRST_TO_4, 5, 2, /exactly one team/i],
    [TOTAL_OF_6, 4, 1, /add up to 6/],
    [RALLY_24, -1, 25, /whole numbers/],
    [RALLY_24, 12.5, 11.5, /whole numbers/],
    [RALLY_24, Number.NaN, 24, /whole numbers/],
  ])("rejects %o %d-%d", (config, a, b, message) => {
    const result = validateFinal(config, a, b);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_FINAL_SCORE");
    expect(result.error.message).toMatch(message);
  });
});
