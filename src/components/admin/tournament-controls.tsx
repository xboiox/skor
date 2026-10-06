"use client";

import Link from "next/link";
import { useState } from "react";
import { FieldError } from "@/components/ui/field-error";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/components/ui/styles";
import { useHydrated } from "@/hooks/use-hydrated";
import type { TournamentBoard } from "@/server/tournaments/board";
import { useHostAction } from "./use-host-action";

interface TournamentControlsProps {
  board: TournamentBoard;
}

type Confirmable = "repeat" | "end";

const CONFIRM_TEXT: Record<Confirmable, string> = {
  repeat: "Play every round again with sides swapped (home/away)?",
  end: "End the tournament? Scores can no longer be entered or changed.",
};

export function TournamentControls({ board }: TournamentControlsProps) {
  const isHydrated = useHydrated();
  const { run, error, busyKey, isBusy } = useHostAction();
  const [confirming, setConfirming] = useState<Confirmable | null>(null);
  const { id, slug, matchType, currentLeg, status } = board.tournament;
  const base = `/api/tournaments/${id}`;

  if (status !== "active") return null;

  const latest = board.rounds.at(-1);
  const latestDone = latest !== undefined && latest.matches.every((m) => m.status === "approved");
  const disabled = !isHydrated || isBusy;

  async function confirm(action: Confirmable) {
    if (await run(action, `${base}/${action}`, "POST")) setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold">Manage</h2>
      <FieldError message={error ?? undefined} />

      {matchType === "mexicano" && (
        <button
          type="button"
          disabled={disabled || !latestDone}
          onClick={() => run("next", `${base}/rounds/next`, "POST")}
          className={PRIMARY_BUTTON_CLASS}
        >
          {busyKey === "next"
            ? "Creating round…"
            : latestDone
              ? `Start round ${(latest?.number ?? 0) + 1}`
              : `Approve all of round ${latest?.number} to continue`}
        </button>
      )}

      <Link href={`/t/${slug}/admin/replace`} className={SECONDARY_BUTTON_CLASS}>
        Replace a player
      </Link>

      {confirming ? (
        <div className="border-danger bg-surface flex flex-col gap-3 rounded-xl border-2 p-4">
          <p className="font-semibold">{CONFIRM_TEXT[confirming]}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className={`${SECONDARY_BUTTON_CLASS} w-28`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => confirm(confirming)}
              className={PRIMARY_BUTTON_CLASS}
            >
              {busyKey === confirming ? "Working…" : "Yes"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          {matchType === "americano" && currentLeg === 1 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirming("repeat")}
              className={`${SECONDARY_BUTTON_CLASS} flex-1`}
            >
              Repeat (home/away)
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setConfirming("end")}
            className={`${SECONDARY_BUTTON_CLASS} text-danger flex-1`}
          >
            End tournament
          </button>
        </div>
      )}
    </section>
  );
}
