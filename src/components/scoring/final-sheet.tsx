"use client";

import { useState, type FormEvent } from "react";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/components/ui/styles";

interface FinalSheetProps {
  title?: string;
  teamA: string;
  teamB: string;
  initialA: number;
  initialB: number;
  hint: string;
  isBusy: boolean;
  /** Shown inside the sheet so it is not hidden behind the backdrop. */
  error?: string | null;
  onSubmit: (scoreA: number, scoreB: number) => void;
  onClose: () => void;
}

/** Bottom sheet for "final result only" entry. */
export function FinalSheet({
  title = "Final result",
  teamA,
  teamB,
  initialA,
  initialB,
  hint,
  isBusy,
  error,
  onSubmit,
  onClose,
}: FinalSheetProps) {
  const [scoreA, setScoreA] = useState(String(initialA));
  const [scoreB, setScoreB] = useState(String(initialB));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(Number(scoreA), Number(scoreB));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-20 flex items-end bg-black/50"
    >
      <form
        method="post"
        onSubmit={submit}
        className="pb-safe bg-surface w-full rounded-t-2xl px-4 pt-5"
      >
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="text-muted text-sm">{hint}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: teamA, value: scoreA, set: setScoreA },
            { label: teamB, value: scoreB, set: setScoreB },
          ].map((side) => (
            <label key={side.label} className="flex flex-col gap-1.5">
              <span className="truncate font-semibold">{side.label}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                required
                value={side.value}
                onChange={(e) => side.set(e.currentTarget.value)}
                className={`${INPUT_CLASS} tabular text-center text-3xl font-extrabold`}
              />
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-danger mt-3 font-medium">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onClose} className={`${SECONDARY_BUTTON_CLASS} w-28`}>
            Cancel
          </button>
          <button type="submit" disabled={isBusy} className={PRIMARY_BUTTON_CLASS}>
            {isBusy ? "Saving…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
