"use client";

import { useEffect, useRef, useState } from "react";
import type { TournamentEvent } from "@/server/realtime/events";

export type StreamStatus = "connecting" | "live" | "reconnecting" | "offline";

const EVENT_TYPES = ["match.updated", "tournament.updated"] as const;

/**
 * Follows a tournament over SSE. `onEvent` gets every change; `onResync` runs whenever events may
 * have been missed — on (re)connect and when the tab comes back — so a full refresh is needed.
 */
export function useTournamentStream(
  slug: string,
  handlers: { onEvent: (event: TournamentEvent) => void; onResync: () => void },
): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const source = new EventSource(`/api/t/${slug}/stream`);
    let hasConnected = false;

    // Resync on every "ready", including the first: changes saved between the server render
    // and this connection were never sent as events.
    source.addEventListener("ready", () => {
      latest.current.onResync();
      hasConnected = true;
      setStatus("live");
    });
    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (message) => {
        try {
          latest.current.onEvent(
            JSON.parse((message as MessageEvent<string>).data) as TournamentEvent,
          );
        } catch {
          latest.current.onResync(); // unreadable event: fall back to a full refresh
        }
      });
    }
    source.onerror = () => setStatus(navigator.onLine ? "reconnecting" : "offline");

    // Mobile browsers pause background tabs; resync when the player comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible" && hasConnected) latest.current.onResync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      source.close();
    };
  }, [slug]);

  return status;
}
