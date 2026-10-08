import { describe, expect, it } from "vitest";
import { parseStepParam } from "./step-param";

describe("parseStepParam", () => {
  it.each([
    [null, 0],
    ["0", 0],
    ["2", 2],
    ["3", 3],
    ["9", 3],
    ["-1", 0],
    ["abc", 0],
    ["1.5", 0],
  ])("%s → step %i", (raw, step) => {
    expect(parseStepParam(raw)).toBe(step);
  });
});
