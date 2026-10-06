import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/api-response";
import type { CreateTournamentInput } from "@/lib/validation/tournament";
import { matches, rounds, scoreEvents, tournaments } from "@/server/db/schema";
import { approveMatch, editMatchScore, rejectMatch } from "@/server/matches/host-actions";
import { applyScoreAction, type Actor } from "@/server/matches/score-actions";
import { createTournament } from "@/server/tournaments/create";
import { startTournament } from "@/server/tournaments/start";
import { connectTestDb, truncateAll } from "./test-db";

const { sql, db } = connectTestDb();
const HOST: Actor = { role: "host", userId: null };

function input(overrides: Partial<CreateTournamentInput> = {}): CreateTournamentInput {
  return {
    name: "Scoring",
    date: "2026-10-03",
    matchType: "americano",
    courts: 2,
    scoring: { type: "rally", totalPoints: 16 },
    players: Array.from({ length: 8 }, (_, i) => `P${i + 1}`),
    ...overrides,
  };
}

async function startedTournament(overrides: Partial<CreateTournamentInput> = {}) {
  const { tournament } = await createTournament(db, input(overrides), {
    ownerId: null,
    guestTtlDays: 7,
  });
  await startTournament(db, tournament.id);
  const roundOne = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.tournamentId, tournament.id), eq(rounds.number, 1)));
  const roundMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.roundId, roundOne[0]!.id))
    .orderBy(asc(matches.court));
  const player: Actor = { role: "player", playerId: roundMatches[0]!.teamA1 };
  return { tournamentId: tournament.id, match: roundMatches[0]!, roundMatches, player };
}

async function errorOf(promise: Promise<unknown>): Promise<AppError | null> {
  return promise.then(
    () => null,
    (err: unknown) => {
      if (err instanceof AppError) return err;
      throw err;
    },
  );
}

/** Plays `count` points for a team, threading the version through. */
async function points(
  matchId: string,
  team: "A" | "B",
  count: number,
  actor: Actor,
  startVersion: number,
) {
  let version = startVersion;
  for (let i = 0; i < count; i += 1) {
    version = (
      await applyScoreAction(db, {
        matchId,
        expectedVersion: version,
        actor,
        action: { type: "point", team },
      })
    ).version;
  }
  return version;
}

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await sql.end();
});

describe("live points", () => {
  it("adds a point, bumps the version and records who scored", async () => {
    const { match, player } = await startedTournament();
    const view = await applyScoreAction(db, {
      matchId: match.id,
      expectedVersion: 0,
      actor: player,
      action: { type: "point", team: "A" },
    });
    expect(view).toMatchObject({ scoreA: 1, scoreB: 0, status: "in_progress", version: 1 });

    const [event] = await db.select().from(scoreEvents).where(eq(scoreEvents.matchId, match.id));
    expect(event).toMatchObject({
      action: "point_a",
      actorRole: "player",
      actorPlayerId: player.role === "player" ? player.playerId : null,
      prevState: { scoreA: 0, scoreB: 0, gameA: 0, gameB: 0, status: "scheduled" },
    });
  });

  it("rejects a stale version with the current match state", async () => {
    const { match, player } = await startedTournament();
    await points(match.id, "A", 1, player, 0);
    const error = await errorOf(
      applyScoreAction(db, {
        matchId: match.id,
        expectedVersion: 0,
        actor: player,
        action: { type: "point", team: "B" },
      }),
    );
    expect(error?.code).toBe("VERSION_CONFLICT");
    expect(error?.details).toMatchObject({ match: { scoreA: 1, scoreB: 0, version: 1 } });
  });

  it("lets exactly one of two simultaneous taps through", async () => {
    const { match, player } = await startedTournament();
    const tap = () =>
      applyScoreAction(db, {
        matchId: match.id,
        expectedVersion: 0,
        actor: player,
        action: { type: "point", team: "A" },
      });
    const results = await Promise.allSettled([tap(), tap()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [row] = await db.select().from(matches).where(eq(matches.id, match.id));
    expect(row?.scoreA).toBe(1);
  });

  it("submits the match automatically when the total is reached (A6)", async () => {
    const { match, player } = await startedTournament();
    let version = await points(match.id, "A", 10, player, 0);
    version = await points(match.id, "B", 6, player, version);
    const [row] = await db.select().from(matches).where(eq(matches.id, match.id));
    expect(row).toMatchObject({ scoreA: 10, scoreB: 6, status: "submitted", version });
  });

  it("refuses points once the match is complete", async () => {
    const { match, player } = await startedTournament();
    const version = await points(match.id, "A", 16, player, 0);
    const error = await errorOf(
      applyScoreAction(db, {
        matchId: match.id,
        expectedVersion: version,
        actor: player,
        action: { type: "point", team: "B" },
      }),
    );
    expect(error?.code).toBe("INVALID_STATE");
  });

  it("tracks tennis game points", async () => {
    const { match, player } = await startedTournament({
      scoring: { type: "tennis", mode: "first_to", games: 4, deuce: "golden_point" },
    });
    const view = await applyScoreAction(db, {
      matchId: match.id,
      expectedVersion: 0,
      actor: player,
      action: { type: "point", team: "B" },
    });
    expect(view).toMatchObject({
      scoreA: 0,
      scoreB: 0,
      gameA: 0,
      gameB: 1,
      display: { a: "0", b: "15" },
    });
  });
});

describe("undo", () => {
  it("restores the state before the last point", async () => {
    const { match, player } = await startedTournament();
    const version = await points(match.id, "A", 2, player, 0);
    const view = await applyScoreAction(db, {
      matchId: match.id,
      expectedVersion: version,
      actor: player,
      action: { type: "undo" },
    });
    expect(view).toMatchObject({ scoreA: 1, status: "in_progress", version: version + 1 });
  });

  it("re-opens a match that was auto-submitted", async () => {
    const { match, player } = await startedTournament();
    const version = await points(match.id, "A", 16, player, 0);
    const view = await applyScoreAction(db, {
      matchId: match.id,
      expectedVersion: version,
      actor: player,
      action: { type: "undo" },
    });
    expect(view).toMatchObject({ scoreA: 15, status: "in_progress" });
  });

  it("supports undoing several points in a row", async () => {
    const { match, player } = await startedTournament();
    let version = await points(match.id, "A", 3, player, 0);
    for (let i = 0; i < 3; i += 1) {
      version = (
        await applyScoreAction(db, {
          matchId: match.id,
          expectedVersion: version,
          actor: player,
          action: { type: "undo" },
        })
      ).version;
    }
    const [row] = await db.select().from(matches).where(eq(matches.id, match.id));
    expect(row).toMatchObject({ scoreA: 0, status: "scheduled" });
  });

  it("has nothing to undo on a fresh match", async () => {
    const { match, player } = await startedTournament();
    const error = await errorOf(
      applyScoreAction(db, {
        matchId: match.id,
        expectedVersion: 0,
        actor: player,
        action: { type: "undo" },
      }),
    );
    expect(error?.code).toBe("INVALID_STATE");
  });
});

describe("final result", () => {
  it("submits a valid final score", async () => {
    const { match, player } = await startedTournament();
    const view = await applyScoreAction(db, {
      matchId: match.id,
      expectedVersion: 0,
      actor: player,
      action: { type: "final", scoreA: 9, scoreB: 7 },
    });
    expect(view).toMatchObject({ scoreA: 9, scoreB: 7, status: "submitted" });
  });

  it("rejects an impossible score with a clear message", async () => {
    const { match, player } = await startedTournament();
    const error = await errorOf(
      applyScoreAction(db, {
        matchId: match.id,
        expectedVersion: 0,
        actor: player,
        action: { type: "final", scoreA: 9, scoreB: 9 },
      }),
    );
    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Scores must add up to 16 points (got 18).",
    });
  });
});

describe("host approval", () => {
  it("approves a submitted match and locks it for players", async () => {
    const { match, player } = await startedTournament();
    await applyScoreAction(db, {
      matchId: match.id,
      expectedVersion: 0,
      actor: player,
      action: { type: "final", scoreA: 9, scoreB: 7 },
    });
    const approved = await approveMatch(db, { matchId: match.id, expectedVersion: 1, actor: HOST });
    expect(approved).toMatchObject({ status: "approved", version: 2 });

    const error = await errorOf(
      applyScoreAction(db, {
        matchId: match.id,
        expectedVersion: 2,
        actor: player,
        action: { type: "undo" },
      }),
    );
    expect(error?.code).toBe("INVALID_STATE");
  });

  it("only approves submitted matches", async () => {
    const { match, player } = await startedTournament();
    await points(match.id, "A", 1, player, 0);
    expect(
      (await errorOf(approveMatch(db, { matchId: match.id, expectedVersion: 1, actor: HOST })))
        ?.code,
    ).toBe("INVALID_STATE");
  });

  it("rejects a submitted score back to in progress, keeping the score", async () => {
    const { match, player } = await startedTournament();
    await applyScoreAction(db, {
      matchId: match.id,
      expectedVersion: 0,
      actor: player,
      action: { type: "final", scoreA: 9, scoreB: 7 },
    });
    expect(
      await rejectMatch(db, { matchId: match.id, expectedVersion: 1, actor: HOST }),
    ).toMatchObject({
      status: "in_progress",
      scoreA: 9,
    });
  });

  it("lets the host correct any score, which approves it", async () => {
    const { match } = await startedTournament();
    const view = await editMatchScore(db, {
      matchId: match.id,
      expectedVersion: 0,
      actor: HOST,
      scoreA: 4,
      scoreB: 12,
    });
    expect(view).toMatchObject({ scoreA: 4, scoreB: 12, status: "approved" });
    const again = await editMatchScore(db, {
      matchId: match.id,
      expectedVersion: view.version,
      actor: HOST,
      scoreA: 8,
      scoreB: 8,
    });
    expect(again).toMatchObject({ scoreA: 8, scoreB: 8, status: "approved" });
  });

  it("validates host edits too", async () => {
    const { match } = await startedTournament();
    const error = await errorOf(
      editMatchScore(db, {
        matchId: match.id,
        expectedVersion: 0,
        actor: HOST,
        scoreA: 1,
        scoreB: 1,
      }),
    );
    expect(error?.code).toBe("VALIDATION_ERROR");
  });
});

describe("round progress", () => {
  it("completes a round when every match is approved and activates the next", async () => {
    const { tournamentId, roundMatches } = await startedTournament();
    for (const m of roundMatches) {
      await editMatchScore(db, {
        matchId: m.id,
        expectedVersion: 0,
        actor: HOST,
        scoreA: 8,
        scoreB: 8,
      });
    }
    const all = await db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournamentId))
      .orderBy(asc(rounds.number));
    expect(all.slice(0, 3).map((r) => r.status)).toEqual(["completed", "active", "pending"]);
  });

  it("allows scoring a later round before the current one is approved", async () => {
    const { tournamentId } = await startedTournament();
    const [roundTwo] = await db
      .select()
      .from(rounds)
      .where(and(eq(rounds.tournamentId, tournamentId), eq(rounds.number, 2)));
    const [later] = await db
      .select()
      .from(matches)
      .where(eq(matches.roundId, roundTwo!.id))
      .limit(1);
    const view = await applyScoreAction(db, {
      matchId: later!.id,
      expectedVersion: 0,
      actor: { role: "player", playerId: later!.teamA1 },
      action: { type: "point", team: "A" },
    });
    expect(view.scoreA).toBe(1);
  });
});

describe("tournament state", () => {
  it("refuses scoring once the tournament has finished", async () => {
    const { tournamentId, match, player } = await startedTournament();
    await db
      .update(tournaments)
      .set({ status: "finished" })
      .where(eq(tournaments.id, tournamentId));
    const error = await errorOf(
      applyScoreAction(db, {
        matchId: match.id,
        expectedVersion: 0,
        actor: player,
        action: { type: "point", team: "A" },
      }),
    );
    expect(error?.code).toBe("INVALID_STATE");
  });

  it("reports an unknown match as NOT_FOUND", async () => {
    const error = await errorOf(
      applyScoreAction(db, {
        matchId: "00000000-0000-4000-8000-000000000000",
        expectedVersion: 0,
        actor: HOST,
        action: { type: "point", team: "A" },
      }),
    );
    expect(error?.code).toBe("NOT_FOUND");
  });
});
