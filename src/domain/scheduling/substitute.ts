import { failure, success, type Result } from "../result";
import type { Pair, PlayerId, SchedulingError } from "./types";

export type MatchStatus = "scheduled" | "in_progress" | "submitted" | "approved";
export type PlayerStatus = "active" | "withdrawn";

export type ScheduledMatch = {
  readonly id: string;
  readonly roundNumber: number;
  readonly status: MatchStatus;
  readonly teamA: Pair;
  readonly teamB: Pair;
};

export type RoundByes = { readonly roundNumber: number; readonly playerIds: readonly PlayerId[] };

export type SubstitutionInput = {
  readonly type: "temporary" | "permanent";
  readonly fromRound: number;
  readonly outPlayerId: PlayerId;
  /** A new player must already exist in `players` (the service creates it first). */
  readonly substitute: {
    readonly source: "new_player" | "bye_player";
    readonly playerId: PlayerId;
  };
  readonly players: readonly { readonly id: PlayerId; readonly status: PlayerStatus }[];
  readonly matches: readonly ScheduledMatch[];
  readonly byes: readonly RoundByes[];
};

export type PlayerUpdate = {
  readonly playerId: PlayerId;
  readonly status?: PlayerStatus;
  readonly joinedRound?: number;
  readonly withdrawnFromRound?: number;
};

export type SubstitutionPlan = {
  readonly matchUpdates: readonly {
    readonly matchId: string;
    readonly teamA: Pair;
    readonly teamB: Pair;
  }[];
  readonly byeUpdates: readonly RoundByes[];
  readonly playerUpdates: readonly PlayerUpdate[];
};

type PlanResult = Result<SubstitutionPlan, SchedulingError>;

function invalid(message: string): PlanResult {
  return failure({ code: "INVALID_SUBSTITUTION", message });
}

const inMatch = (match: ScheduledMatch, id: PlayerId) =>
  [...match.teamA, ...match.teamB].includes(id);
const swap = (pair: Pair, out: PlayerId, sub: PlayerId): Pair =>
  [pair[0] === out ? sub : pair[0], pair[1] === out ? sub : pair[1]] as const;

function validate(input: SubstitutionInput): string | null {
  const { outPlayerId, substitute, players, matches, byes } = input;
  const status = new Map(players.map((p) => [p.id, p.status]));

  if (!Number.isInteger(input.fromRound) || input.fromRound < 1)
    return "Round number must be 1 or higher.";
  if (substitute.playerId === outPlayerId) return "A player cannot replace themselves.";
  for (const id of [outPlayerId, substitute.playerId]) {
    if (!status.has(id)) return "That player is not in this tournament.";
    if (status.get(id) === "withdrawn") return "That player has already withdrawn.";
  }
  if (input.type === "permanent" && substitute.source !== "new_player") {
    return "A permanent substitute must be a new player.";
  }
  if (substitute.source === "new_player") {
    const scheduled =
      matches.some((m) => inMatch(m, substitute.playerId)) ||
      byes.some((b) => b.playerIds.includes(substitute.playerId));
    if (scheduled) return "That player is already in the schedule — choose a bye player instead.";
  }
  if (substitute.source === "bye_player") {
    const roundByes = byes.find((b) => b.roundNumber === input.fromRound)?.playerIds ?? [];
    if (!roundByes.includes(substitute.playerId)) {
      return `That player is not on a bye in round ${input.fromRound}.`;
    }
  }
  return null;
}

function planTemporary(input: SubstitutionInput): PlanResult {
  const { fromRound, outPlayerId, substitute } = input;
  const match = input.matches.find((m) => m.roundNumber === fromRound && inMatch(m, outPlayerId));
  if (!match) return invalid(`That player is not playing in round ${fromRound}.`);
  if (match.status !== "scheduled") return invalid("That match has already started.");

  const byeUpdates =
    substitute.source === "bye_player"
      ? input.byes
          .filter((b) => b.roundNumber === fromRound)
          .map((b) => ({
            roundNumber: b.roundNumber,
            playerIds: b.playerIds.filter((id) => id !== substitute.playerId),
          }))
      : [];
  // A one-off new player is inactive after this round, so Mexicano does not schedule them again.
  const playerUpdates: PlayerUpdate[] =
    substitute.source === "new_player"
      ? [
          {
            playerId: substitute.playerId,
            joinedRound: fromRound,
            status: "withdrawn",
            withdrawnFromRound: fromRound + 1,
          },
        ]
      : [];

  return success({
    matchUpdates: [
      {
        matchId: match.id,
        teamA: swap(match.teamA, outPlayerId, substitute.playerId),
        teamB: swap(match.teamB, outPlayerId, substitute.playerId),
      },
    ],
    byeUpdates,
    playerUpdates,
  });
}

function planPermanent(input: SubstitutionInput): PlanResult {
  const { fromRound, outPlayerId, substitute } = input;
  const matchUpdates = input.matches
    .filter(
      (m) => m.roundNumber >= fromRound && m.status === "scheduled" && inMatch(m, outPlayerId),
    )
    .map((m) => ({
      matchId: m.id,
      teamA: swap(m.teamA, outPlayerId, substitute.playerId),
      teamB: swap(m.teamB, outPlayerId, substitute.playerId),
    }));
  const byeUpdates = input.byes
    .filter((b) => b.roundNumber >= fromRound && b.playerIds.includes(outPlayerId))
    .map((b) => ({
      roundNumber: b.roundNumber,
      playerIds: b.playerIds.map((id) => (id === outPlayerId ? substitute.playerId : id)),
    }));

  return success({
    matchUpdates,
    byeUpdates,
    playerUpdates: [
      { playerId: outPlayerId, status: "withdrawn", withdrawnFromRound: fromRound },
      { playerId: substitute.playerId, joinedRound: fromRound },
    ],
  });
}

/** Plans a substitution; the service applies the plan in one transaction. */
export function planSubstitution(input: SubstitutionInput): PlanResult {
  const error = validate(input);
  if (error) return invalid(error);
  return input.type === "temporary" ? planTemporary(input) : planPermanent(input);
}
