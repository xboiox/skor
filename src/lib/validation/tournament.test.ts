import { describe, expect, it } from "vitest";
import { createTournamentSchema, parsePlayerList, playerNameSchema } from "./tournament";

const VALID = {
  name: "  Friday Americano  ",
  date: "2026-10-03",
  matchType: "americano",
  courts: 2,
  scoring: { type: "rally", totalPoints: 24 },
  players: ["Andi", "Budi", "Citra", "Dewi"],
};

function issues(input: unknown): string[] {
  const result = createTournamentSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("createTournamentSchema", () => {
  it("accepts a valid rally tournament and trims the name", () => {
    const result = createTournamentSchema.parse(VALID);
    expect(result.name).toBe("Friday Americano");
  });

  it("accepts tennis scoring with a deuce rule", () => {
    const tennis = {
      ...VALID,
      scoring: { type: "tennis", mode: "first_to", games: 6, deuce: "golden_point" },
    };
    expect(issues(tennis)).toEqual([]);
  });

  it.each([16, 21, 24, 32])("accepts %i rally points", (totalPoints) => {
    expect(issues({ ...VALID, scoring: { type: "rally", totalPoints } })).toEqual([]);
  });

  it("rejects other rally totals", () => {
    expect(issues({ ...VALID, scoring: { type: "rally", totalPoints: 20 } })).toEqual([
      "scoring.totalPoints",
    ]);
  });

  it.each([0, 13, 4.5])("rejects %s tennis games", (games) => {
    const tennis = {
      ...VALID,
      scoring: { type: "tennis", mode: "total_of", games, deuce: "advantage" },
    };
    expect(issues(tennis)).toEqual(["scoring.games"]);
  });

  it("requires a deuce rule for tennis", () => {
    const tennis = { ...VALID, scoring: { type: "tennis", mode: "first_to", games: 4 } };
    expect(issues(tennis)).toEqual(["scoring.deuce"]);
  });

  it.each([
    [{ ...VALID, name: "   " }, "name"],
    [{ ...VALID, name: "x".repeat(101) }, "name"],
    [{ ...VALID, date: "03/10/2026" }, "date"],
    [{ ...VALID, date: "2026-02-30" }, "date"],
    [{ ...VALID, matchType: "knockout" }, "matchType"],
    [{ ...VALID, courts: 0 }, "courts"],
    [{ ...VALID, courts: 21 }, "courts"],
  ])("rejects an invalid field (%#)", (input, path) => {
    expect(issues(input)).toEqual([path]);
  });

  it("needs at least 4 players", () => {
    expect(issues({ ...VALID, players: ["A", "B", "C"] })).toEqual(["players"]);
  });

  it("rejects duplicate player names regardless of case and spacing", () => {
    expect(issues({ ...VALID, players: ["Andi", "Budi", "Citra", " andi "] })).toEqual(["players"]);
  });

  it("rejects more than 100 players", () => {
    const many = Array.from({ length: 101 }, (_, i) => `Player ${i}`);
    expect(issues({ ...VALID, players: many })).toEqual(["players"]);
  });
});

describe("playerNameSchema", () => {
  it("trims and collapses inner spaces", () => {
    expect(playerNameSchema.parse("  Andi   Wijaya ")).toBe("Andi Wijaya");
  });

  it.each(["", "   ", "x".repeat(51)])("rejects %j", (name) => {
    expect(playerNameSchema.safeParse(name).success).toBe(false);
  });
});

describe("parsePlayerList", () => {
  it("splits pasted text by lines and commas, dropping blanks and list markers", () => {
    expect(parsePlayerList("1. Andi\n- Budi, Citra\n\n• Dewi \n2) Eka")).toEqual([
      "Andi",
      "Budi",
      "Citra",
      "Dewi",
      "Eka",
    ]);
  });

  it("removes duplicates, keeping the first spelling", () => {
    expect(parsePlayerList("Andi\nandi\nBudi")).toEqual(["Andi", "Budi"]);
  });
});
