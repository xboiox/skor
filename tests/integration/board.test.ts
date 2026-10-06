import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getTournamentBoard } from "@/server/tournaments/board";
import { createTournament } from "@/server/tournaments/create";
import { startTournament } from "@/server/tournaments/start";
import { connectTestDb, truncateAll } from "./test-db";

const { sql, db } = connectTestDb();

beforeEach(async () => {
  await truncateAll(sql);
});

afterAll(async () => {
  await sql.end();
});

describe("getTournamentBoard", () => {
  it("returns rounds in order with matches, byes and player names", async () => {
    const { tournament } = await createTournament(
      db,
      {
        name: "Board",
        date: "2026-10-03",
        matchType: "mexicano",
        courts: 2,
        scoring: { type: "tennis", mode: "first_to", games: 4, deuce: "golden_point" },
        players: Array.from({ length: 10 }, (_, i) => `P${i + 1}`),
      },
      { ownerId: null, guestTtlDays: 7 },
    );
    await startTournament(db, tournament.id);

    const board = await getTournamentBoard(db, tournament.id);
    expect(board?.tournament).toMatchObject({
      name: "Board",
      status: "active",
      scoringLabel: "Tennis · first to 4 games · golden point",
    });
    expect(board?.scoring).toEqual({
      type: "tennis",
      mode: "first_to",
      games: 4,
      deuce: "golden_point",
    });
    expect(board?.players).toHaveLength(10);
    expect(board?.rounds).toHaveLength(1);
    const [round] = board!.rounds;
    expect(round).toMatchObject({ number: 1, status: "active" });
    expect(round!.matches.map((m) => m.court)).toEqual([1, 2]);
    expect(round!.matches[0]!.display).toEqual({ a: "0", b: "0", phase: "normal" });
    expect(round!.byes).toHaveLength(2);
  });

  it("returns null for an unknown tournament", async () => {
    expect(await getTournamentBoard(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
