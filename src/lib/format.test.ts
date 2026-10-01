import { describe, expect, it } from "vitest";
import { formatDate, formatMatchType, formatScoring } from "./format";

describe("formatScoring", () => {
  it("describes rally scoring", () => {
    expect(
      formatScoring({
        scoringType: "rally",
        rallyPoints: 24,
        tennisMode: null,
        tennisGames: null,
        deuceRule: null,
      }),
    ).toBe("Rally points · 24 per match");
  });

  it("describes tennis scoring", () => {
    expect(
      formatScoring({
        scoringType: "tennis",
        rallyPoints: null,
        tennisMode: "first_to",
        tennisGames: 6,
        deuceRule: "golden_point",
      }),
    ).toBe("Tennis · first to 6 games · golden point");
    expect(
      formatScoring({
        scoringType: "tennis",
        rallyPoints: null,
        tennisMode: "total_of",
        tennisGames: 4,
        deuceRule: "advantage",
      }),
    ).toBe("Tennis · 4 games total · advantage");
  });
});

describe("formatMatchType", () => {
  it("capitalises the format", () => {
    expect(formatMatchType("americano")).toBe("Americano");
    expect(formatMatchType("mexicano")).toBe("Mexicano");
  });
});

describe("formatDate", () => {
  it("formats an ISO date without timezone shifts", () => {
    expect(formatDate("2026-10-03")).toBe("Sat, 3 Oct 2026");
  });
});
