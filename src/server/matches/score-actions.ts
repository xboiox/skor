import { asc, eq } from "drizzle-orm";
import { applyPoint, findUndoTarget, statusForScore, validateFinal } from "@/domain/scoring";
import { AppError } from "@/lib/api-response";
import type { Database } from "@/server/db/client";
import { scoreEvents } from "@/server/db/schema";
import { assertNotApproved, lockMatch, saveMatch, type Actor } from "./match-store";
import type { MatchView } from "./view";

export type { Actor } from "./match-store";

export type ScoreAction =
  | { readonly type: "point"; readonly team: "A" | "B" }
  | { readonly type: "undo" }
  | { readonly type: "final"; readonly scoreA: number; readonly scoreB: number };

export type ScoreActionInput = {
  readonly matchId: string;
  readonly expectedVersion: number;
  readonly actor: Actor;
  readonly action: ScoreAction;
};

/** Live scoring by players or the host: a point, an undo, or a final result. */
export async function applyScoreAction(db: Database, input: ScoreActionInput): Promise<MatchView> {
  return db.transaction(async (tx) => {
    const locked = await lockMatch(tx, input.matchId, input.expectedVersion);
    const { match, config } = locked;
    assertNotApproved(match);
    const { action, actor } = input;

    if (action.type === "point") {
      const result = applyPoint(config, match, action.team);
      if (!result.ok) throw new AppError("INVALID_STATE", result.error.message);
      return saveMatch(
        tx,
        locked,
        { ...result.value, status: statusForScore(config, result.value) },
        { action: action.team === "A" ? "point_a" : "point_b", actor },
      );
    }

    if (action.type === "final") {
      const result = validateFinal(config, action.scoreA, action.scoreB);
      if (!result.ok) throw new AppError("VALIDATION_ERROR", result.error.message);
      return saveMatch(
        tx,
        locked,
        { ...result.value, status: "submitted" },
        { action: "set_final", actor },
      );
    }

    const events = await tx
      .select({ id: scoreEvents.id, action: scoreEvents.action, prevState: scoreEvents.prevState })
      .from(scoreEvents)
      .where(eq(scoreEvents.matchId, match.id))
      .orderBy(asc(scoreEvents.id));
    const target = findUndoTarget(events);
    if (!target) throw new AppError("INVALID_STATE", "Nothing to undo.");
    return saveMatch(tx, locked, target.prevState, { action: "undo", actor });
  });
}
