import { describe, expect, it } from "vitest";
import { repeatAsSecondLeg } from "./repeat";
import type { PlannedRound } from "./types";

const LEG_ONE: PlannedRound[] = [
  { number: 1, leg: 1, matches: [{ court: 1, teamA: ["a", "b"], teamB: ["c", "d"] }], byes: ["e"] },
  { number: 2, leg: 1, matches: [{ court: 1, teamA: ["a", "c"], teamB: ["e", "d"] }], byes: ["b"] },
];

describe("repeatAsSecondLeg", () => {
  it("repeats every round with teams swapped, numbering on from the last round", () => {
    const result = repeatAsSecondLeg(LEG_ONE);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          number: 3,
          leg: 2,
          matches: [{ court: 1, teamA: ["c", "d"], teamB: ["a", "b"] }],
          byes: ["e"],
        },
        {
          number: 4,
          leg: 2,
          matches: [{ court: 1, teamA: ["e", "d"], teamB: ["a", "c"] }],
          byes: ["b"],
        },
      ],
    });
  });

  it("does not mutate the first leg", () => {
    const frozen = Object.freeze(LEG_ONE.map((r) => Object.freeze({ ...r })));
    repeatAsSecondLeg(frozen);
    expect(frozen[0]!.leg).toBe(1);
  });

  it("refuses when there is nothing to repeat", () => {
    expect(repeatAsSecondLeg([]).ok).toBe(false);
  });

  it("refuses when a second leg already exists", () => {
    const repeated = repeatAsSecondLeg(LEG_ONE);
    if (!repeated.ok) throw new Error("setup failed");
    const result = repeatAsSecondLeg([...LEG_ONE, ...repeated.value]);
    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_INPUT", message: expect.stringMatching(/already/) },
    });
  });
});
