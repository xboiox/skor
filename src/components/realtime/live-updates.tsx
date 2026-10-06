"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTournamentStream } from "@/hooks/use-tournament-stream";
import { LiveStatus } from "./live-status";

interface LiveUpdatesProps {
  slug: string;
}

const REFRESH_DEBOUNCE_MS = 300;

/** Re-renders the page (server data) when the tournament changes; shows the connection state. */
export function LiveUpdates({ slug }: LiveUpdatesProps) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const status = useTournamentStream(slug, { onEvent: refresh, onResync: refresh });
  return <LiveStatus status={status} />;
}
