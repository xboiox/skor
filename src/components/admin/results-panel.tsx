"use client";

import { useState } from "react";
import { MATCH_STATUS_LABEL } from "@/components/play/match-card";
import { FinalSheet } from "@/components/scoring/final-sheet";
import { FieldError } from "@/components/ui/field-error";
import { useHydrated } from "@/hooks/use-hydrated";
import type { MatchView } from "@/server/matches/view";
import type { TournamentBoard } from "@/server/tournaments/board";
import { useHostAction } from "./use-host-action";

interface ResultsPanelProps {
  board: TournamentBoard;
  finalHint: string;
}

/** Approval queue on top, then every round's results with a host "Edit" for corrections. */
export function ResultsPanel({ board, finalHint }: ResultsPanelProps) {
  const isHydrated = useHydrated();
  const { run, error, busyKey, isBusy } = useHostAction();
  const [editing, setEditing] = useState<MatchView | null>(null);
  const names = new Map(board.players.map((p) => [p.id, p.name]));
  const team = (ids: readonly [string, string]) =>
    ids.map((id) => names.get(id) ?? "?").join(" / ");
  const isRunning = board.tournament.status === "active";

  const submitted = board.rounds.flatMap((r) =>
    r.matches.filter((m) => m.status === "submitted").map((m) => ({ round: r.number, match: m })),
  );
  const disabled = !isHydrated || isBusy || !isRunning;
  const smallButton = "min-h-12 flex-1 rounded-xl font-bold disabled:opacity-50";

  return (
    <div className="flex flex-col gap-6">
      <FieldError message={error ?? undefined} />

      <section className="flex flex-col gap-2">
        <h2 className="font-bold">
          Needs approval <span className="tabular text-muted">({submitted.length})</span>
        </h2>
        {submitted.length === 0 && <p className="text-muted">Nothing to approve right now.</p>}
        {submitted.map(({ round, match }) => (
          <article
            key={match.id}
            className="border-primary bg-surface flex flex-col gap-3 rounded-xl border-2 p-4"
          >
            <p className="text-muted text-sm font-semibold">
              Round {round} · Court {match.court}
            </p>
            <p className="flex justify-between font-semibold">
              <span>{team(match.teamA)}</span>
              <span className="tabular text-xl font-extrabold">{match.scoreA}</span>
            </p>
            <p className="flex justify-between font-semibold">
              <span>{team(match.teamB)}</span>
              <span className="tabular text-xl font-extrabold">{match.scoreB}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  run(match.id, `/api/matches/${match.id}/approve`, "POST", {
                    expectedVersion: match.version,
                  })
                }
                className={`${smallButton} bg-primary text-primary-foreground`}
              >
                {busyKey === match.id ? "…" : "Approve"}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setEditing(match)}
                className={`${smallButton} border-border border`}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  run(`reject-${match.id}`, `/api/matches/${match.id}/reject`, "POST", {
                    expectedVersion: match.version,
                  })
                }
                className={`${smallButton} border-border text-danger border`}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">All results</h2>
        {board.rounds.map((round) => (
          <details
            key={round.id}
            open={round.status === "active"}
            className="border-border bg-surface rounded-xl border p-4"
          >
            <summary className="min-h-8 font-semibold">
              Round {round.number} ·{" "}
              {round.status === "completed"
                ? "complete"
                : round.status === "active"
                  ? "now"
                  : "upcoming"}
            </summary>
            <ul className="mt-3 flex flex-col gap-3">
              {round.matches.map((match) => (
                <li key={match.id} className="flex items-center justify-between gap-3">
                  <span className="flex flex-col text-sm">
                    <span className="font-semibold">
                      {team(match.teamA)} <span className="text-muted">vs</span> {team(match.teamB)}
                    </span>
                    <span className="text-muted">
                      Court {match.court} · {MATCH_STATUS_LABEL[match.status]}
                      {match.status !== "scheduled" && (
                        <span className="tabular text-foreground font-bold">
                          {" "}
                          · {match.scoreA}–{match.scoreB}
                        </span>
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setEditing(match)}
                    className="border-border min-h-12 shrink-0 rounded-xl border px-4 font-bold disabled:opacity-50"
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      {editing && (
        <FinalSheet
          title="Set result (host)"
          teamA={team(editing.teamA)}
          teamB={team(editing.teamB)}
          initialA={editing.scoreA}
          initialB={editing.scoreB}
          hint={`${finalHint} Saving approves the result.`}
          isBusy={isBusy}
          error={error}
          onClose={() => setEditing(null)}
          onSubmit={async (scoreA, scoreB) => {
            const ok = await run(`edit-${editing.id}`, `/api/matches/${editing.id}`, "PATCH", {
              expectedVersion: editing.version,
              scoreA,
              scoreB,
            });
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}
