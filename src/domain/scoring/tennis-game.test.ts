import { describe, expect, it } from "vitest";
import { formatGamePoint, winGamePoint } from "./tennis-game";
import type { Team } from "./types";

type GameState = { a: number; b: number };

function play(rule: "golden_point" | "advantage", teams: Team[]) {
  return teams.reduce<{ state: GameState; winner: Team | null }>(
    (acc, team) => {
      if (acc.winner) throw new Error("game already won");
      return winGamePoint(rule, acc.state, team);
    },
    { state: { a: 0, b: 0 }, winner: null },
  );
}

describe("winGamePoint", () => {
  it("counts points without winning before 40", () => {
    expect(play("golden_point", ["A", "A", "B"])).toEqual({ state: { a: 2, b: 1 }, winner: null });
  });

  it("wins the game on the fourth point with a clear lead", () => {
    expect(play("advantage", ["A", "A", "A", "A"])).toEqual({ state: { a: 0, b: 0 }, winner: "A" });
  });

  it("does not mutate the input state", () => {
    const state = Object.freeze({ a: 1, b: 2 });
    winGamePoint("advantage", state, "A");
    expect(state).toEqual({ a: 1, b: 2 });
  });

  describe("golden point", () => {
    it("decides the game on the next point at 40-40", () => {
      const deuce: Team[] = ["A", "A", "A", "B", "B", "B"];
      expect(play("golden_point", [...deuce, "B"]).winner).toBe("B");
      expect(play("golden_point", [...deuce, "A"]).winner).toBe("A");
    });
  });

  describe("advantage", () => {
    const deuce: Team[] = ["A", "A", "A", "B", "B", "B"];

    it("gives advantage instead of the game at 40-40", () => {
      expect(play("advantage", [...deuce, "A"])).toEqual({ state: { a: 4, b: 3 }, winner: null });
    });

    it("returns to deuce (normalised to 3-3) when the advantage is lost", () => {
      expect(play("advantage", [...deuce, "A", "B"])).toEqual({
        state: { a: 3, b: 3 },
        winner: null,
      });
    });

    it("wins from advantage", () => {
      expect(play("advantage", [...deuce, "B", "B"]).winner).toBe("B");
    });

    it("keeps raw points bounded through many deuces", () => {
      const longDeuce: Team[] = [
        ...deuce,
        ...Array.from({ length: 20 }, (_, i): Team => (i % 2 ? "B" : "A")),
      ];
      expect(play("advantage", longDeuce).state).toEqual({ a: 3, b: 3 });
    });
  });
});

describe("formatGamePoint", () => {
  it.each([
    [
      { a: 0, b: 0 },
      { a: "0", b: "0", phase: "normal" },
    ],
    [
      { a: 1, b: 0 },
      { a: "15", b: "0", phase: "normal" },
    ],
    [
      { a: 2, b: 3 },
      { a: "30", b: "40", phase: "normal" },
    ],
  ])("shows tennis points for %o", (state, expected) => {
    expect(formatGamePoint("advantage", state)).toEqual(expected);
  });

  it("shows deuce at 40-40 with advantage rule", () => {
    expect(formatGamePoint("advantage", { a: 3, b: 3 })).toEqual({
      a: "40",
      b: "40",
      phase: "deuce",
    });
  });

  it("shows golden point at 40-40 with golden point rule", () => {
    expect(formatGamePoint("golden_point", { a: 3, b: 3 })).toEqual({
      a: "40",
      b: "40",
      phase: "golden_point",
    });
  });

  it("shows AD for the team with advantage", () => {
    expect(formatGamePoint("advantage", { a: 4, b: 3 })).toEqual({
      a: "AD",
      b: "40",
      phase: "advantage",
    });
    expect(formatGamePoint("advantage", { a: 3, b: 4 })).toEqual({
      a: "40",
      b: "AD",
      phase: "advantage",
    });
  });
});
