import { describe, expect, it } from "vitest";
import { PairCounter } from "./pair-counter";

describe("PairCounter", () => {
  it("counts pairs regardless of order", () => {
    const counter = new PairCounter(["a", "b", "c"]);
    counter.add("a", "b");
    expect(counter.add("b", "a")).toBe(2);
    expect(counter.get("a", "b")).toBe(2);
    expect(counter.get("a", "c")).toBe(0);
  });

  it("reports spread as the sum of squared counts", () => {
    const counter = new PairCounter(["a", "b", "c"]);
    counter.add("a", "b");
    counter.add("a", "b");
    counter.add("b", "c");
    expect(counter.spread()).toBe(4 + 1);
  });

  it("rejects unknown players", () => {
    expect(() => new PairCounter(["a"]).get("a", "z")).toThrow(/Unknown player/);
  });
});
