import { asc, count, desc, eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { players, rounds, tournaments } from "@/server/db/schema";

export type TournamentRow = typeof tournaments.$inferSelect;

export type TournamentOverview = {
  readonly tournament: TournamentRow;
  readonly players: readonly {
    id: string;
    name: string;
    position: number;
    status: "active" | "withdrawn";
  }[];
  readonly roundCount: number;
};

export async function getTournamentOverview(
  db: Database,
  tournamentId: string,
): Promise<TournamentOverview | null> {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) return null;

  const [roster, [roundTotal]] = await Promise.all([
    db
      .select({
        id: players.id,
        name: players.name,
        position: players.position,
        status: players.status,
      })
      .from(players)
      .where(eq(players.tournamentId, tournamentId))
      .orderBy(asc(players.position)),
    db.select({ total: count() }).from(rounds).where(eq(rounds.tournamentId, tournamentId)),
  ]);
  return { tournament, players: roster, roundCount: roundTotal?.total ?? 0 };
}

export type OwnedTournament = Pick<
  TournamentRow,
  "id" | "slug" | "name" | "date" | "matchType" | "status"
> & {
  readonly playerCount: number;
};

export async function listOwnedTournaments(
  db: Database,
  ownerId: string,
): Promise<OwnedTournament[]> {
  return db
    .select({
      id: tournaments.id,
      slug: tournaments.slug,
      name: tournaments.name,
      date: tournaments.date,
      matchType: tournaments.matchType,
      status: tournaments.status,
      playerCount: count(players.id),
    })
    .from(tournaments)
    .leftJoin(players, eq(players.tournamentId, tournaments.id))
    .where(eq(tournaments.ownerId, ownerId))
    .groupBy(tournaments.id)
    .orderBy(desc(tournaments.date), desc(tournaments.createdAt));
}
