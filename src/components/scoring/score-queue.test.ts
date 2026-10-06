import { describe, expect, it } from "vitest";
import type { ScoringConfig } from "@/domain/scoring";
import {
  displayedScore,
  enqueuePoint,
  isLocked,
  receiveRemote,
  type QueueState,
} from "./score-queue";

const RALLY_16: ScoringConfig = { type: "rally", totalPoints: 16 };
const TENNIS: ScoringConfig = { type: "tennis", mode: "first_to", games: 4, deuce: "golden_point" };

function state(
  overrides: Partial<QueueState["server"]> = {},
  queue: ("A" | "B")[] = [],
): QueueState {
  return {
    server: {
      scoreA: 0,
      scoreB: 0,
      gameA: 0,
      gameB: 0,
      status: "scheduled",
      version: 0,
      ...overrides,
    },
    queue,
  };
}

describe("displayedScore", () => {
  it("shows the server score when nothing is pending", () => {
    expect(displayedScore(RALLY_16, state({ scoreA: 3, scoreB: 2 }))).toMatchObject({
      scoreA: 3,
      scoreB: 2,
    });
  });

  it("adds pending taps on top of the server score", () => {
    expect(displayedScore(RALLY_16, state({ scoreA: 3 }, ["A", "B", "A"]))).toMatchObject({
      scoreA: 5,
      scoreB: 1,
    });
  });

  it("runs pending taps through tennis rules", () => {
    expect(displayedScore(TENNIS, state({}, ["A", "A", "A", "A"]))).toMatchObject({
      scoreA: 1,
      gameA: 0,
    });
  });

  it("ignores taps beyond the end of the match", () => {
    expect(displayedScore(RALLY_16, state({ scoreA: 15 }, ["A", "A", "A"]))).toMatchObject({
      scoreA: 16,
    });
  });
});

describe("enqueuePoint", () => {
  it("queues a tap without mutating the state", () => {
    const before = state();
    const after = enqueuePoint(RALLY_16, before, "B");
    expect(after.queue).toEqual(["B"]);
    expect(before.queue).toEqual([]);
  });

  it("drops taps once the displayed match is complete", () => {
    const full = state({ scoreA: 10 }, ["B", "B", "B", "B", "B", "B"]);
    expect(enqueuePoint(RALLY_16, full, "A").queue).toHaveLength(6);
  });
});

describe("isLocked", () => {
  it("locks submitted and approved matches", () => {
    expect(isLocked(RALLY_16, state({ status: "submitted" }))).toBe(true);
    expect(isLocked(RALLY_16, state({ status: "approved" }))).toBe(true);
    expect(isLocked(RALLY_16, state({ status: "in_progress" }))).toBe(false);
  });

  it("locks once pending taps complete the match", () => {
    expect(isLocked(RALLY_16, state({ scoreA: 15 }, ["B"]))).toBe(true);
  });
});

describe("receiveRemote", () => {
  const remote = {
    scoreA: 4,
    scoreB: 2,
    gameA: 0,
    gameB: 0,
    status: "in_progress" as const,
    version: 6,
  };

  it("applies a newer version from another phone", () => {
    expect(receiveRemote(state({ version: 5 }), remote).server).toEqual(remote);
  });

  it("ignores stale or duplicate versions (e.g. our own update echoed back)", () => {
    const current = state({ scoreA: 4, scoreB: 2, version: 6 });
    expect(receiveRemote(current, remote)).toBe(current);
    expect(receiveRemote(state({ version: 9 }), remote).server.version).toBe(9);
  });

  it("waits while our own taps are still being sent (the conflict path handles it)", () => {
    const busy = state({ version: 5 }, ["A"]);
    expect(receiveRemote(busy, remote)).toBe(busy);
  });
});
