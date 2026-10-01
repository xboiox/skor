import type { PlannedRound } from "@/domain/scheduling";
import type { Transaction } from "@/server/db/client";
import { matches, roundByes, rounds } from "@/server/db/schema";

/** Persists planned rounds with their matches and byes. `activeRound` starts as active, the rest pending. */
export async function saveRounds(
  tx: Transaction,
  tournamentId: string,
  planned: readonly PlannedRound[],
  activeRound: number | null,
): Promise<void> {
  if (planned.length === 0) return;

  const inserted = await tx
    .insert(rounds)
    .values(
      planned.map((round) => ({
        tournamentId,
        number: round.number,
        leg: round.leg,
        status: round.number === activeRound ? ("active" as const) : ("pending" as const),
      })),
    )
    .returning({ id: rounds.id, number: rounds.number });
  const roundIdByNumber = new Map(inserted.map((r) => [r.number, r.id]));

  const matchRows = planned.flatMap((round) =>
    round.matches.map((match) => ({
      tournamentId,
      roundId: roundIdByNumber.get(round.number)!,
      court: match.court,
      teamA1: match.teamA[0],
      teamA2: match.teamA[1],
      teamB1: match.teamB[0],
      teamB2: match.teamB[1],
    })),
  );
  if (matchRows.length > 0) await tx.insert(matches).values(matchRows);

  const byeRows = planned.flatMap((round) =>
    round.byes.map((playerId) => ({ roundId: roundIdByNumber.get(round.number)!, playerId })),
  );
  if (byeRows.length > 0) await tx.insert(roundByes).values(byeRows);
}
