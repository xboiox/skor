"use client";

import { useState, type FormEvent } from "react";
import { minAmericanoRounds, roundCapacity } from "@/domain/scheduling";
import { FieldError } from "@/components/ui/field-error";
import { useHydrated } from "@/hooks/use-hydrated";
import { INPUT_CLASS } from "@/components/ui/styles";
import { MIN_PLAYERS } from "@/lib/validation/tournament";
import { addPlayers, removePlayer, type FormState } from "./form-state";

interface PlayersStepProps {
  state: FormState;
  error?: string;
  onChange: (players: string[]) => void;
}

function capacityHint(state: FormState): string | null {
  const count = state.players.length;
  if (count < MIN_PLAYERS) return null;
  const { matches, byes } = roundCapacity(count, state.courts);
  const perRound = `${matches} ${matches === 1 ? "match" : "matches"} per round, ${byes} sitting out`;
  if (state.matchType === "mexicano") return perRound;
  return `${perRound} · about ${minAmericanoRounds(count, state.courts)} rounds to partner everyone`;
}

export function PlayersStep({ state, error, onChange }: PlayersStepProps) {
  const [draft, setDraft] = useState("");
  const [isPasting, setIsPasting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const isHydrated = useHydrated();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { players, skipped } = addPlayers(state.players, draft);
    onChange(players);
    setNotice(skipped.length > 0 ? `Already added: ${skipped.join(", ")}` : null);
    setDraft("");
    setIsPasting(false);
  }

  const hint = capacityHint(state);
  return (
    <div className="flex flex-col gap-4">
      <form method="post" onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="player-input" className="font-semibold">
          {isPasting ? "Paste names (one per line)" : "Add player"}
        </label>
        {isPasting ? (
          <textarea
            id="player-input"
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            placeholder={"Andi\nBudi\nCitra"}
            className={`${INPUT_CLASS} py-3`}
          />
        ) : (
          <div className="flex gap-2">
            <input
              id="player-input"
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              autoComplete="off"
              enterKeyHint="done"
              placeholder="Player name"
              className={INPUT_CLASS}
            />
            <button
              type="submit"
              disabled={!isHydrated}
              className="bg-primary text-primary-foreground min-h-12 shrink-0 rounded-xl px-5 font-bold disabled:opacity-60"
            >
              Add
            </button>
          </div>
        )}
        <div className="flex gap-2">
          {isPasting && (
            <button
              type="submit"
              className="bg-primary text-primary-foreground min-h-12 flex-1 rounded-xl font-bold"
            >
              Add all
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsPasting(!isPasting)}
            className="border-border bg-surface min-h-12 flex-1 rounded-xl border font-bold"
          >
            {isPasting ? "Type one by one" : "Paste a list"}
          </button>
        </div>
        {notice && <p className="text-muted text-sm">{notice}</p>}
      </form>

      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">
          Players <span className="tabular text-muted">({state.players.length})</span>
        </h2>
      </div>
      {hint && <p className="bg-surface text-muted rounded-xl px-4 py-3 text-sm">{hint}</p>}
      <FieldError message={error} />

      <ol className="flex flex-col gap-2">
        {state.players.map((name, index) => (
          <li
            key={name}
            className="border-border bg-surface flex min-h-12 items-center gap-3 rounded-xl border pl-4"
          >
            <span className="tabular text-muted w-6">{index + 1}</span>
            <span className="flex-1 font-semibold">{name}</span>
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => onChange(removePlayer(state.players, index))}
              className="text-muted flex size-12 items-center justify-center text-2xl"
            >
              ×
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
