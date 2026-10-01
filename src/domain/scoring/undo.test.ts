import { describe, expect, it } from "vitest";
import { findUndoTarget, type ScoreEventRef } from "./undo";

let nextId = 1;
const ev = (action: ScoreEventRef["action"]): ScoreEventRef => ({ id: nextId++, action });

describe("findUndoTarget", () => {
  it("returns null when there is nothing to undo", () => {
    expect(findUndoTarget([])).toBeNull();
  });

  it("targets the most recent point", () => {
    const p1 = ev("point_a");
    const p2 = ev("point_b");
    expect(findUndoTarget([p1, p2])).toBe(p2);
  });

  it("skips points that were already undone", () => {
    const p1 = ev("point_a");
    const p2 = ev("point_b");
    expect(findUndoTarget([p1, p2, ev("undo")])).toBe(p1);
  });

  it("supports consecutive undos", () => {
    const p1 = ev("point_a");
    const p2 = ev("point_a");
    const p3 = ev("point_b");
    expect(findUndoTarget([p1, p2, p3, ev("undo"), ev("undo")])).toBe(p1);
  });

  it("returns null when every point has been undone", () => {
    expect(findUndoTarget([ev("point_a"), ev("undo")])).toBeNull();
  });

  it("can undo a submitted final result", () => {
    const final = ev("set_final");
    expect(findUndoTarget([ev("point_a"), final])).toBe(final);
  });

  it("looks past a host rejection", () => {
    const p1 = ev("point_a");
    expect(findUndoTarget([p1, ev("reject")])).toBe(p1);
  });

  it.each(["approve", "host_edit"] as const)("stops at %s", (boundary) => {
    expect(findUndoTarget([ev("point_a"), ev(boundary)])).toBeNull();
  });

  it("does not depend on input order being mutated", () => {
    const events = Object.freeze([ev("point_a"), ev("point_b")]);
    findUndoTarget(events);
    expect(events).toHaveLength(2);
  });
});
