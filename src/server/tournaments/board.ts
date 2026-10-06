import { asc, eq, inArray } from "drizzle-orm";
import type { ScoringConfig } from "@/domain/scoring";
import { formatScoring } from "@/lib/format";
import type { Database } from "@/server/db/client";
import { matches, players, roundByes, rounds, tournaments } from "@/server/db/schema";
import { scoringConfigOf } from "@/server/matches/scoring-config";
import { toMatchView, type MatchView } from "@/server/matches/view";

export type BoardRound = {
  readonly id: string;
  readonly number: number;
  readonly leg: number;
  readonly status: "pending" | "active" | "completed";
  readonly matches: readonly MatchView[];
  readonly byes: readonly string[];
};

export type TournamentBoard = {
  readonly tournament: {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly date: string;
    readonly matchType: "americano" | "mexicano";
    readonly courts: number;
    readonly status: "draft" | "active" | "finished";
    readonly currentLeg: number;
    readonly scoringLabel: string;
  };
  readonly scoring: ScoringConfig;
  readonly players: readonly {
    readonly id: string;
    readonly name: string;
    readonly status: "active" | "withdrawn";
    readonly joinedRound: number | null;
  }[];
  readonly rounds: readonly BoardRound[];
};

/** Everything a tournament screen needs in one read: players, rounds, matches and byes. */
export async function getTournamentBoard(
  db: Database,
  tournamentId: string,
): Promise<TournamentBoard | null> {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!t) return null;
  const scoring = scoringConfigOf(t);

  const [roster, roundRows, matchRows] = await Promise.all([
    db
      .select({
        id: players.id,
        name: players.name,
        status: players.status,
        joinedRound: players.joinedRound,
      })
      .from(players)
      .where(eq(players.tournamentId, tournamentId))
      .orderBy(asc(players.position)),
    db
      .select()
      .from(rounds)
      .where(eq(rounds.tournamentId, tournamentId))
      .orderBy(asc(rounds.number)),
    db
      .select()
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId))
      .orderBy(asc(matches.court)),
  ]);
  const byeRows = roundRows.length
    ? await db
        .select()
        .from(roundByes)
        .where(
          inArray(
            roundByes.roundId,
            roundRows.map((r) => r.id),
          ),
        )
    : [];

  return {
    tournament: {
      id: t.id,
      slug: t.slug,
      name: t.name,
      date: t.date,
      matchType: t.matchType,
      courts: t.courts,
      status: t.status,
      currentLeg: t.currentLeg,
      scoringLabel: formatScoring(t),
    },
    scoring,
    players: roster,
    rounds: roundRows.map((round) => ({
      id: round.id,
      number: round.number,
      leg: round.leg,
      status: round.status,
      matches: matchRows.filter((m) => m.roundId === round.id).map((m) => toMatchView(m, scoring)),
      byes: byeRows.filter((b) => b.roundId === round.id).map((b) => b.playerId),
    })),
  };
}
