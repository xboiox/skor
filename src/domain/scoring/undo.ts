export type ScoreAction =
  "point_a" | "point_b" | "undo" | "set_final" | "approve" | "reject" | "host_edit";

export type ScoreEventRef = { readonly id: number; readonly action: ScoreAction };

const UNDOABLE: ReadonlySet<ScoreAction> = new Set(["point_a", "point_b", "set_final"]);
// Approved or host-edited results are locked; undo never reaches past them.
const BOUNDARY: ReadonlySet<ScoreAction> = new Set(["approve", "host_edit"]);

/**
 * Finds the event an undo should revert, given the match's events oldest → newest.
 * The caller restores that event's `prev_state` snapshot.
 */
export function findUndoTarget<E extends ScoreEventRef>(events: readonly E[]): E | null {
  let pendingUndos = 0;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]!;
    if (BOUNDARY.has(event.action)) return null;
    if (event.action === "undo") {
      pendingUndos += 1;
      continue;
    }
    if (!UNDOABLE.has(event.action)) continue;
    if (pendingUndos === 0) return event;
    pendingUndos -= 1;
  }
  return null;
}
