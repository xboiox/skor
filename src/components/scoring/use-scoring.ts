"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScoringConfig, Team } from "@/domain/scoring";
import { apiRequest } from "@/lib/api-client";
import type { MatchView } from "@/server/matches/view";
import { enqueuePoint, type QueueState, type ServerMatch } from "./score-queue";

const TAP_VIBRATION_MS = 15;

type ScoreRequest = { type: "undo" } | { type: "final"; scoreA: number; scoreB: number };

const toServer = (m: MatchView): ServerMatch => ({
  scoreA: m.scoreA,
  scoreB: m.scoreB,
  gameA: m.gameA,
  gameB: m.gameB,
  status: m.status,
  version: m.version,
});

function conflictMatch(details: unknown): MatchView | null {
  const match = (details as { match?: MatchView } | undefined)?.match;
  return match ?? null;
}

/**
 * Optimistic live scoring. Taps show instantly and are sent one at a time with the latest
 * version; a conflict resyncs to the server's score, a network error drops unsent taps.
 */
export function useScoring(matchId: string, config: ScoringConfig, initial: MatchView) {
  const [state, setState] = useState<QueueState>({ server: toServer(initial), queue: [] });
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isSending = useRef(false);
  const url = `/api/matches/${matchId}/actions`;

  const handleFailure = useCallback(
    (error: { code: string; message: string; details?: unknown }) => {
      const latest = error.code === "VERSION_CONFLICT" ? conflictMatch(error.details) : null;
      setState((s) => ({ server: latest ? toServer(latest) : s.server, queue: [] }));
      setNotice(latest ? "Score was updated on another phone." : error.message);
    },
    [],
  );

  useEffect(() => {
    const [team] = state.queue;
    if (!team || isSending.current) return;
    isSending.current = true;
    apiRequest<MatchView>(url, {
      method: "POST",
      body: { expectedVersion: state.server.version, action: { type: "point", team } },
    }).then((result) => {
      isSending.current = false;
      if (result.success)
        setState((s) => ({ server: toServer(result.data), queue: s.queue.slice(1) }));
      else handleFailure(result.error);
    });
  }, [state, url, handleFailure]);

  const tap = useCallback(
    (team: Team) => {
      navigator.vibrate?.(TAP_VIBRATION_MS);
      setNotice(null);
      setState((s) => enqueuePoint(config, s, team));
    },
    [config],
  );

  /** Undo and final results wait for pending taps and return whether they succeeded. */
  const send = useCallback(
    async (action: ScoreRequest): Promise<boolean> => {
      if (state.queue.length > 0 || isSending.current) return false;
      setIsBusy(true);
      setNotice(null);
      const result = await apiRequest<MatchView>(url, {
        method: "POST",
        body: { expectedVersion: state.server.version, action },
      });
      setIsBusy(false);
      if (result.success) {
        setState({ server: toServer(result.data), queue: [] });
        return true;
      }
      handleFailure(result.error);
      return false;
    },
    [state, url, handleFailure],
  );

  return {
    state,
    notice,
    isBusy,
    isPending: state.queue.length > 0,
    tap,
    send,
    clearNotice: () => setNotice(null),
  };
}

/** Keeps the screen on while scoring (Screen Wake Lock), re-acquiring it when the tab returns. */
export function useWakeLock(): void {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        lock = null; // not supported or denied (e.g. low battery) — scoring still works
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);
}
