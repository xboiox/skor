import { describe, expect, it } from "vitest";
import { planSubstitution, type ScheduledMatch, type SubstitutionInput } from "./substitute";

// Round 1: m1 approved. Round 2: m2 scheduled. Round 3: m3 scheduled, "c" on bye.
const MATCHES: ScheduledMatch[] = [
  { id: "m1", roundNumber: 1, status: "approved", teamA: ["a", "b"], teamB: ["c", "d"] },
  { id: "m2", roundNumber: 2, status: "scheduled", teamA: ["a", "c"], teamB: ["b", "e"] },
  { id: "m3", roundNumber: 3, status: "scheduled", teamA: ["a", "d"], teamB: ["b", "e"] },
];
const BYES = [
  { roundNumber: 1, playerIds: ["e"] },
  { roundNumber: 2, playerIds: ["d"] },
  { roundNumber: 3, playerIds: ["c"] },
];
const PLAYERS = ["a", "b", "c", "d", "e"].map((id) => ({ id, status: "active" as const }));
const WITH_NEW = [...PLAYERS, { id: "new", status: "active" as const }];

function input(overrides: Partial<SubstitutionInput>): SubstitutionInput {
  return {
    type: "temporary",
    fromRound: 2,
    outPlayerId: "a",
    substitute: { source: "new_player", playerId: "new" },
    players: WITH_NEW,
    matches: MATCHES,
    byes: BYES,
    ...overrides,
  };
}

function expectError(result: ReturnType<typeof planSubstitution>, message: RegExp) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe("INVALID_SUBSTITUTION");
  expect(result.error.message).toMatch(message);
}

describe("planSubstitution — temporary", () => {
  it("puts a new player into that round only and deactivates them afterwards", () => {
    expect(planSubstitution(input({}))).toEqual({
      ok: true,
      value: {
        matchUpdates: [{ matchId: "m2", teamA: ["new", "c"], teamB: ["b", "e"] }],
        byeUpdates: [],
        playerUpdates: [
          { playerId: "new", joinedRound: 2, status: "withdrawn", withdrawnFromRound: 3 },
        ],
      },
    });
  });

  it("uses a bye player and takes them off that round's byes", () => {
    const result = planSubstitution(
      input({ substitute: { source: "bye_player", playerId: "d" }, players: PLAYERS }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        matchUpdates: [{ matchId: "m2", teamA: ["d", "c"], teamB: ["b", "e"] }],
        byeUpdates: [{ roundNumber: 2, playerIds: [] }],
        playerUpdates: [],
      },
    });
  });

  it("refuses a bye player who is not on a bye that round", () => {
    expectError(
      planSubstitution(
        input({ substitute: { source: "bye_player", playerId: "e" }, players: PLAYERS }),
      ),
      /not on a bye in round 2/,
    );
  });

  it("refuses when the outgoing player is on a bye that round", () => {
    expectError(planSubstitution(input({ outPlayerId: "d" })), /not playing in round 2/);
  });

  it("refuses when the outgoing player's match has already started", () => {
    expectError(planSubstitution(input({ fromRound: 1 })), /already started/);
  });
});

describe("planSubstitution — permanent", () => {
  it("hands every remaining scheduled slot and bye to the new player", () => {
    const result = planSubstitution(input({ type: "permanent", outPlayerId: "c" }));
    expect(result).toEqual({
      ok: true,
      value: {
        matchUpdates: [{ matchId: "m2", teamA: ["a", "new"], teamB: ["b", "e"] }],
        byeUpdates: [{ roundNumber: 3, playerIds: ["new"] }],
        playerUpdates: [
          { playerId: "c", status: "withdrawn", withdrawnFromRound: 2 },
          { playerId: "new", joinedRound: 2 },
        ],
      },
    });
  });

  it("skips matches that have already started", () => {
    const started = MATCHES.map((m) =>
      m.id === "m2" ? { ...m, status: "in_progress" as const } : m,
    );
    const result = planSubstitution(input({ type: "permanent", matches: started }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.matchUpdates.map((u) => u.matchId)).toEqual(["m3"]);
  });

  it("works when no future rounds exist yet (Mexicano)", () => {
    const result = planSubstitution(input({ type: "permanent", fromRound: 4 }));
    expect(result).toEqual({
      ok: true,
      value: {
        matchUpdates: [],
        byeUpdates: [],
        playerUpdates: [
          { playerId: "a", status: "withdrawn", withdrawnFromRound: 4 },
          { playerId: "new", joinedRound: 4 },
        ],
      },
    });
  });

  it("refuses a bye player as a permanent substitute (A8)", () => {
    expectError(
      planSubstitution(
        input({ type: "permanent", substitute: { source: "bye_player", playerId: "d" } }),
      ),
      /new player/,
    );
  });
});

describe("planSubstitution — validation", () => {
  it("refuses replacing a player with themselves", () => {
    expectError(
      planSubstitution(input({ substitute: { source: "new_player", playerId: "a" } })),
      /themselves/,
    );
  });

  it("refuses an unknown outgoing player", () => {
    expectError(planSubstitution(input({ outPlayerId: "zzz" })), /not in this tournament/);
  });

  it("refuses an unknown substitute", () => {
    expectError(planSubstitution(input({ players: PLAYERS })), /not in this tournament/);
  });

  it("refuses a withdrawn outgoing player", () => {
    const players = WITH_NEW.map((p) =>
      p.id === "a" ? { ...p, status: "withdrawn" as const } : p,
    );
    expectError(planSubstitution(input({ players })), /already withdrawn/);
  });

  it("refuses a withdrawn substitute", () => {
    const players = WITH_NEW.map((p) =>
      p.id === "new" ? { ...p, status: "withdrawn" as const } : p,
    );
    expectError(planSubstitution(input({ players })), /already withdrawn/);
  });

  it("refuses a 'new' player who is already in the schedule", () => {
    expectError(
      planSubstitution(input({ substitute: { source: "new_player", playerId: "b" } })),
      /already in the schedule/,
    );
  });

  it("refuses a round number below 1", () => {
    expectError(planSubstitution(input({ fromRound: 0 })), /round/i);
  });

  it("does not mutate the input schedule", () => {
    const matches = MATCHES.map((m) => Object.freeze({ ...m }));
    planSubstitution(input({ type: "permanent", matches }));
    expect(matches[1]!.teamA).toEqual(["a", "c"]);
  });
});
