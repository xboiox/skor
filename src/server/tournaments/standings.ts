import { computeLeaderboard, type Leaderboard, type LeaderboardMode } from "@/domain/leaderboard";
import type { MatchView } from "@/server/matches/view";
import type { TournamentBoard } from "./board";

/** Leaderboard straight from the board data (no extra queries). */
export function standingsOf(board: TournamentBoard, mode: LeaderboardMode): Leaderboard {
  return computeLeaderboard({
    mode,
    players: board.players,
    matches: board.rounds.flatMap((r) => r.matches),
  });
}

export type HistoryEntry = {
  readonly round: number;
  readonly partner: string;
  readonly opponents: string;
  readonly scored: number;
  readonly conceded: number;
  readonly status: MatchView["status"];
};

/** A player's played (or running) matches, newest round first, from their side of the net. */
export function playerHistory(board: TournamentBoard, playerId: string): HistoryEntry[] {
  const name = (id: string) => board.players.find((p) => p.id === id)?.name ?? "?";
  return board.rounds
    .flatMap((round) =>
      round.matches
        .filter((m) => m.status !== "scheduled")
        .flatMap((m): HistoryEntry[] => {
          const onA = m.teamA.includes(playerId);
          if (!onA && !m.teamB.includes(playerId)) return [];
          const own = onA ? m.teamA : m.teamB;
          const other = onA ? m.teamB : m.teamA;
          return [
            {
              round: round.number,
              partner: name(own.find((id) => id !== playerId)!),
              opponents: other.map(name).join(" / "),
              scored: onA ? m.scoreA : m.scoreB,
              conceded: onA ? m.scoreB : m.scoreA,
              status: m.status,
            },
          ];
        }),
    )
    .reverse();
}
