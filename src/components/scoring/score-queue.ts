import {
  applyPoint,
  isComplete,
  type MatchScore,
  type ScoringConfig,
  type Team,
} from "@/domain/scoring";

export type ServerMatch = MatchScore & {
  readonly status: "scheduled" | "in_progress" | "submitted" | "approved";
  readonly version: number;
};

/** Server truth plus taps not yet confirmed (sent one by one, each with the latest version). */
export type QueueState = { readonly server: ServerMatch; readonly queue: readonly Team[] };

/** What the player sees: the server score with pending taps applied by the same rules as the server. */
export function displayedScore(config: ScoringConfig, state: QueueState): MatchScore {
  return state.queue.reduce<MatchScore>((score, team) => {
    const next = applyPoint(config, score, team);
    return next.ok ? next.value : score;
  }, state.server);
}

export function enqueuePoint(config: ScoringConfig, state: QueueState, team: Team): QueueState {
  if (isComplete(config, displayedScore(config, state))) return state;
  return { ...state, queue: [...state.queue, team] };
}

export function isLocked(config: ScoringConfig, state: QueueState): boolean {
  if (state.server.status === "submitted" || state.server.status === "approved") return true;
  return isComplete(config, displayedScore(config, state));
}

/** Applies a newer state pushed by another phone, unless our own taps are still in flight. */
export function receiveRemote(state: QueueState, remote: ServerMatch): QueueState {
  if (state.queue.length > 0 || remote.version <= state.server.version) return state;
  return { server: remote, queue: [] };
}
