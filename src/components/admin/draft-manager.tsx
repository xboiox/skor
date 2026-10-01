"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FieldError } from "@/components/ui/field-error";
import { useHydrated } from "@/hooks/use-hydrated";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/components/ui/styles";
import { apiRequest } from "@/lib/api-client";
import { MIN_PLAYERS } from "@/lib/validation/tournament";

interface DraftManagerProps {
  tournamentId: string;
  players: readonly { id: string; name: string }[];
}

export function DraftManager({ tournamentId, players }: DraftManagerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirmingStart, setIsConfirmingStart] = useState(false);
  const isHydrated = useHydrated();
  const base = `/api/tournaments/${tournamentId}`;

  async function run(request: Promise<{ success: boolean; error: { message: string } | null }>) {
    setIsBusy(true);
    setError(null);
    const result = await request;
    setIsBusy(false);
    if (!result.success) {
      setError(result.error?.message ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  // Uncontrolled input: text typed before hydration on a slow phone is not wiped by React.
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    if (await run(apiRequest(`${base}/players`, { method: "POST", body: { name } }))) form.reset();
  }

  const canStart = players.length >= MIN_PLAYERS;
  return (
    <div className="flex flex-col gap-4">
      <form method="post" onSubmit={add} className="flex gap-2">
        <label htmlFor="add-player" className="sr-only">
          Player name
        </label>
        <input
          id="add-player"
          name="name"
          required
          placeholder="Add a player"
          autoComplete="off"
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={isBusy || !isHydrated}
          className="bg-primary text-primary-foreground min-h-12 shrink-0 rounded-xl px-5 font-bold disabled:opacity-60"
        >
          Add
        </button>
      </form>
      <FieldError message={error ?? undefined} />

      <h2 className="font-bold">
        Players <span className="tabular text-muted">({players.length})</span>
      </h2>
      <ol className="flex flex-col gap-2">
        {players.map((player, index) => (
          <li
            key={player.id}
            className="border-border bg-surface flex min-h-12 items-center gap-3 rounded-xl border pl-4"
          >
            <span className="tabular text-muted w-6">{index + 1}</span>
            <span className="flex-1 font-semibold">{player.name}</span>
            <button
              type="button"
              aria-label={`Remove ${player.name}`}
              disabled={isBusy}
              onClick={() => run(apiRequest(`${base}/players/${player.id}`, { method: "DELETE" }))}
              className="text-muted flex size-12 items-center justify-center text-2xl"
            >
              ×
            </button>
          </li>
        ))}
      </ol>

      <div className="pb-safe border-border bg-background/95 sticky bottom-0 -mx-4 mt-2 flex flex-col gap-2 border-t px-4 pt-3 backdrop-blur">
        {isConfirmingStart ? (
          <>
            <p className="font-semibold">
              Start now? The schedule is created and players can no longer be changed.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmingStart(false)}
                className={`${SECONDARY_BUTTON_CLASS} w-28`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => run(apiRequest(`${base}/start`, { method: "POST", body: {} }))}
                className={PRIMARY_BUTTON_CLASS}
              >
                {isBusy ? "Starting…" : "Yes, start"}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            disabled={!canStart || !isHydrated}
            onClick={() => setIsConfirmingStart(true)}
            className={PRIMARY_BUTTON_CLASS}
          >
            {canStart ? "Start tournament" : `Add at least ${MIN_PLAYERS} players to start`}
          </button>
        )}
      </div>
    </div>
  );
}
