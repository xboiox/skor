"use client";

import Link from "next/link";
import { useState } from "react";
import { formatGamePoint, type ScoringConfig, type Team } from "@/domain/scoring";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatFinalHint } from "@/lib/format";
import type { MatchView } from "@/server/matches/view";
import { FinalSheet } from "./final-sheet";
import { displayedScore, isLocked } from "./score-queue";
import { useScoring, useWakeLock } from "./use-scoring";

interface ScoringScreenProps {
  slug: string;
  match: MatchView;
  roundNumber: number;
  config: ScoringConfig;
  teamNames: { A: string; B: string };
}

const STATUS_TEXT = {
  scheduled: "Not started",
  in_progress: "Live",
  submitted: "Waiting for host approval",
  approved: "Final ✓",
} as const;

export function ScoringScreen({ slug, match, roundNumber, config, teamNames }: ScoringScreenProps) {
  useWakeLock();
  const isHydrated = useHydrated();
  const { state, notice, isBusy, isPending, tap, send, clearNotice } = useScoring(
    match.id,
    config,
    match,
  );
  const [isFinalOpen, setIsFinalOpen] = useState(false);

  const score = displayedScore(config, state);
  const locked = isLocked(config, state);
  const status = state.server.status;
  const game =
    config.type === "tennis"
      ? formatGamePoint(config.deuce, { a: score.gameA, b: score.gameB })
      : null;
  const left = config.type === "rally" ? config.totalPoints - score.scoreA - score.scoreB : null;
  const canTap = isHydrated && !locked;

  const panel = (team: Team) => {
    const isA = team === "A";
    return (
      <button
        type="button"
        onClick={() => tap(team)}
        disabled={!canTap}
        aria-label={`Point for ${teamNames[team]}`}
        className={`flex flex-1 flex-col items-center justify-center gap-1 px-4 select-none disabled:cursor-default ${
          isA ? "bg-primary text-primary-foreground" : "bg-surface text-foreground"
        }`}
      >
        <span className="text-center text-lg font-bold">{teamNames[team]}</span>
        <span className="tabular text-score font-extrabold" aria-live="polite">
          {isA ? score.scoreA : score.scoreB}
        </span>
        {game && (
          <span className="tabular text-3xl font-bold opacity-90">{isA ? game.a : game.b}</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="pt-safe border-border bg-surface flex items-center justify-between border-b px-2">
        <Link
          href={`/t/${slug}/play`}
          className="text-primary flex min-h-12 items-center px-2 font-semibold"
        >
          ← Matches
        </Link>
        <span className="text-sm font-semibold">
          Court {match.court} · Round {roundNumber}
        </span>
        <span className="text-muted min-w-20 px-2 text-right text-sm font-bold">
          {isPending ? "Saving…" : STATUS_TEXT[status]}
        </span>
      </header>

      <main className="flex flex-1 flex-col landscape:flex-row">
        {panel("A")}
        <div className="border-border bg-background text-muted flex items-center justify-center gap-2 border-y py-1 text-sm font-semibold landscape:flex-col landscape:border-x landscape:border-y-0 landscape:px-2">
          {left !== null && <span className="tabular">{left} left</span>}
          {game && game.phase !== "normal" && (
            <span className="uppercase">{game.phase.replace("_", " ")}</span>
          )}
        </div>
        {panel("B")}
      </main>

      {notice && !isFinalOpen && (
        <p role="alert" className="bg-danger px-4 py-2 text-center font-semibold text-white">
          {notice}
        </p>
      )}

      <footer className="pb-safe border-border bg-surface flex gap-3 border-t px-4 pt-3">
        <button
          type="button"
          disabled={!isHydrated || isBusy || isPending || status === "approved"}
          onClick={() => send({ type: "undo" })}
          className="border-border min-h-14 flex-1 rounded-xl border text-lg font-bold disabled:opacity-40"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          disabled={!isHydrated || isBusy || isPending || status === "approved"}
          onClick={() => setIsFinalOpen(true)}
          className="border-border min-h-14 flex-1 rounded-xl border text-lg font-bold disabled:opacity-40"
        >
          Final…
        </button>
      </footer>

      {isFinalOpen && (
        <FinalSheet
          teamA={teamNames.A}
          teamB={teamNames.B}
          initialA={score.scoreA}
          initialB={score.scoreB}
          hint={formatFinalHint(config)}
          isBusy={isBusy}
          error={notice}
          onClose={() => {
            clearNotice();
            setIsFinalOpen(false);
          }}
          onSubmit={async (a, b) => {
            if (await send({ type: "final", scoreA: a, scoreB: b })) setIsFinalOpen(false);
          }}
        />
      )}
    </div>
  );
}
