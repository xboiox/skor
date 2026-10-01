import { describe, expect, it } from "vitest";
import {
  addPlayers,
  initialFormState,
  removePlayer,
  stepErrors,
  toCreateInput,
  type FormState,
} from "./form-state";

const filled: FormState = {
  ...initialFormState("2026-10-03"),
  name: "Friday Americano",
  players: ["Andi", "Budi", "Citra", "Dewi"],
};

describe("initialFormState", () => {
  it("defaults to Americano, 2 courts, rally 24 and the given date", () => {
    expect(initialFormState("2026-10-03")).toMatchObject({
      date: "2026-10-03",
      matchType: "americano",
      courts: 2,
      scoringType: "rally",
      totalPoints: 24,
      tennisMode: "first_to",
      tennisGames: 6,
      deuce: "golden_point",
      players: [],
    });
  });
});

describe("toCreateInput", () => {
  it("builds rally scoring", () => {
    expect(toCreateInput(filled).scoring).toEqual({ type: "rally", totalPoints: 24 });
  });

  it("builds tennis scoring", () => {
    const tennis = {
      ...filled,
      scoringType: "tennis" as const,
      tennisMode: "total_of" as const,
      tennisGames: 4,
      deuce: "advantage" as const,
    };
    expect(toCreateInput(tennis).scoring).toEqual({
      type: "tennis",
      mode: "total_of",
      games: 4,
      deuce: "advantage",
    });
  });
});

describe("stepErrors", () => {
  it("reports nothing for a complete form", () => {
    expect([0, 1, 2, 3].map((step) => stepErrors(filled, step))).toEqual([{}, {}, {}, {}]);
  });

  it("reports details errors on step 0 only", () => {
    const empty = { ...filled, name: " " };
    expect(stepErrors(empty, 0)).toEqual({ name: "Enter a name" });
    expect(stepErrors(empty, 2)).toEqual({});
  });

  it("reports a custom tennis game count outside 1-12 on the format step", () => {
    const tennis = { ...filled, scoringType: "tennis" as const, tennisGames: 15 };
    expect(Object.keys(stepErrors(tennis, 1))).toEqual(["scoring.games"]);
  });

  it("reports too few players on the players step", () => {
    expect(stepErrors({ ...filled, players: ["A", "B"] }, 2)).toEqual({
      players: "Add at least 4 players",
    });
  });

  it("validates everything on the review step", () => {
    expect(Object.keys(stepErrors({ ...filled, name: "", players: [] }, 3)).sort()).toEqual([
      "name",
      "players",
    ]);
  });
});

describe("player list helpers", () => {
  it("adds pasted names, skipping duplicates already in the list", () => {
    const result = addPlayers(["Andi"], "andi\nBudi, Citra");
    expect(result).toEqual({ players: ["Andi", "Budi", "Citra"], skipped: ["andi"] });
  });

  it("removes by index without mutating", () => {
    const list = Object.freeze(["A", "B", "C"]);
    expect(removePlayer(list, 1)).toEqual(["A", "C"]);
    expect(list).toEqual(["A", "B", "C"]);
  });
});
