import { validateFinal } from "@/domain/scoring";
import { AppError } from "@/lib/api-response";
import type { Database } from "@/server/db/client";
import { lockMatch, saveMatch, type Actor } from "./match-store";
import { refreshRoundProgress } from "./round-progress";
import type { MatchView } from "./view";

type HostInput = {
  readonly matchId: string;
  readonly expectedVersion: number;
  readonly actor: Actor;
};

function assertSubmitted(status: string): void {
  if (status !== "submitted")
    throw new AppError("INVALID_STATE", "Only submitted results can be approved or rejected.");
}

export async function approveMatch(db: Database, input: HostInput): Promise<MatchView> {
  return db.transaction(async (tx) => {
    const locked = await lockMatch(tx, input.matchId, input.expectedVersion);
    assertSubmitted(locked.match.status);
    const view = await saveMatch(
      tx,
      locked,
      {
        scoreA: locked.match.scoreA,
        scoreB: locked.match.scoreB,
        gameA: 0,
        gameB: 0,
        status: "approved",
        approvedAt: new Date(),
      },
      { action: "approve", actor: input.actor },
    );
    await refreshRoundProgress(tx, locked.tournamentId, locked.match.roundId);
    return view;
  });
}

/** Sends a submitted result back to the players; the score is kept so they can fix it. */
export async function rejectMatch(db: Database, input: HostInput): Promise<MatchView> {
  return db.transaction(async (tx) => {
    const locked = await lockMatch(tx, input.matchId, input.expectedVersion);
    assertSubmitted(locked.match.status);
    const { scoreA, scoreB, gameA, gameB } = locked.match;
    return saveMatch(
      tx,
      locked,
      { scoreA, scoreB, gameA, gameB, status: "in_progress" },
      { action: "reject", actor: input.actor },
    );
  });
}

/** The host can set any valid final score at any time; it counts as approved. */
export async function editMatchScore(
  db: Database,
  input: HostInput & { readonly scoreA: number; readonly scoreB: number },
): Promise<MatchView> {
  return db.transaction(async (tx) => {
    const locked = await lockMatch(tx, input.matchId, input.expectedVersion);
    const result = validateFinal(locked.config, input.scoreA, input.scoreB);
    if (!result.ok) throw new AppError("VALIDATION_ERROR", result.error.message);
    const view = await saveMatch(
      tx,
      locked,
      { ...result.value, status: "approved", approvedAt: new Date() },
      { action: "host_edit", actor: input.actor },
    );
    await refreshRoundProgress(tx, locked.tournamentId, locked.match.roundId);
    return view;
  });
}
