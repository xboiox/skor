"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FieldError } from "@/components/ui/field-error";
import { Segmented } from "@/components/ui/segmented";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/components/ui/styles";
import { useHydrated } from "@/hooks/use-hydrated";
import { apiRequest } from "@/lib/api-client";
import type { TournamentBoard } from "@/server/tournaments/board";
import { byeCandidates, roundOptions } from "./replace-options";

interface ReplaceWizardProps {
  board: TournamentBoard;
}

type Preview = { inPlayer: { name: string }; affected: { round: number; court: number }[] };

export function ReplaceWizard({ board }: ReplaceWizardProps) {
  const router = useRouter();
  const isHydrated = useHydrated();
  const { id, slug, matchType } = board.tournament;
  const active = board.players.filter((p) => p.status === "active");
  const rounds = board.rounds.map((r) => ({
    number: r.number,
    status: r.status,
    byes: r.byes,
    matches: r.matches.map((m) => ({ status: m.status, players: [...m.teamA, ...m.teamB] })),
  }));

  const [outId, setOutId] = useState<string | null>(null);
  const [type, setType] = useState<"temporary" | "permanent">("temporary");
  const [round, setRound] = useState<number | null>(null);
  const [source, setSource] = useState<"new_player" | "bye_player">("new_player");
  const [name, setName] = useState("");
  const [byeId, setByeId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const options = outId ? roundOptions({ rounds, outPlayerId: outId, type, matchType }) : [];
  const fromRound = round !== null && options.includes(round) ? round : (options[0] ?? null);
  const candidates = fromRound !== null ? byeCandidates(rounds, fromRound, board.players) : [];
  const effectiveSource = type === "permanent" ? "new_player" : source;
  const request =
    outId && fromRound !== null
      ? {
          type,
          fromRound,
          outPlayerId: outId,
          substitute:
            effectiveSource === "new_player"
              ? { source: "new_player" as const, name }
              : { source: "bye_player" as const, playerId: byeId ?? "" },
        }
      : null;

  const reset = () => {
    setPreview(null);
    setError(null);
  };

  async function call(path: string): Promise<Preview | null> {
    if (!request) return null;
    setIsBusy(true);
    setError(null);
    const result = await apiRequest<Preview>(`/api/tournaments/${id}/substitutions${path}`, {
      method: "POST",
      body: request,
    });
    setIsBusy(false);
    if (!result.success) {
      setError(result.error.message);
      return null;
    }
    return result.data;
  }

  async function confirm() {
    if (await call("")) {
      router.push(`/t/${slug}/admin`);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-bold">1. Who can&apos;t play?</h2>
        <div className="grid grid-cols-2 gap-2">
          {active.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={outId === p.id}
              onClick={() => {
                setOutId(p.id);
                setRound(null);
                reset();
              }}
              className={`min-h-12 rounded-xl border px-3 font-bold ${
                outId === p.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </section>

      {outId && (
        <>
          <Segmented
            label="2. For how long?"
            value={type}
            onChange={(value) => {
              setType(value);
              reset();
            }}
            options={[
              { value: "temporary", label: "One round", hint: "Back after that" },
              { value: "permanent", label: "Rest of event", hint: "Withdraws" },
            ]}
          />

          {options.length === 0 ? (
            <p className="border-border bg-surface text-muted rounded-xl border p-4">
              {type === "temporary"
                ? "This player has no upcoming match that hasn't started. Edit the score of a running match instead."
                : "There are no rounds left to replace this player in."}
            </p>
          ) : (
            <>
              <Segmented
                label={type === "temporary" ? "3. Which round?" : "3. Starting from round"}
                value={fromRound ?? options[0]!}
                onChange={(value) => {
                  setRound(value);
                  reset();
                }}
                options={options.map((n) => ({ value: n, label: String(n) }))}
              />

              {type === "temporary" && (
                <Segmented
                  label="4. Who plays instead?"
                  value={source}
                  onChange={(value) => {
                    setSource(value);
                    reset();
                  }}
                  options={[
                    { value: "new_player", label: "New player" },
                    { value: "bye_player", label: "Someone sitting out" },
                  ]}
                />
              )}

              {effectiveSource === "new_player" ? (
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold">
                    {type === "permanent" ? "4. New player's name" : "Name"}
                  </span>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.currentTarget.value);
                      reset();
                    }}
                    autoComplete="off"
                    className={INPUT_CLASS}
                  />
                </label>
              ) : candidates.length === 0 ? (
                <p className="text-muted">Nobody is sitting out in round {fromRound}.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {candidates.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={byeId === p.id}
                      onClick={() => {
                        setByeId(p.id);
                        reset();
                      }}
                      className={`min-h-12 rounded-xl border px-3 font-bold ${
                        byeId === p.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <FieldError message={error ?? undefined} />

      {preview && (
        <section role="status" className="border-primary bg-surface rounded-xl border-2 p-4">
          <p className="font-bold">
            {preview.inPlayer.name} will play{" "}
            {preview.affected.length === 0
              ? "from the next round that is created."
              : preview.affected.map((a) => `round ${a.round} (court ${a.court})`).join(", ") + "."}
          </p>
          {type === "permanent" && (
            <p className="text-muted text-sm">
              The player who left keeps the points they already scored.
            </p>
          )}
        </section>
      )}

      <div className="pb-safe border-border bg-background/95 sticky bottom-0 -mx-4 flex gap-3 border-t px-4 pt-3 backdrop-blur">
        {preview ? (
          <>
            <button type="button" onClick={reset} className={`${SECONDARY_BUTTON_CLASS} w-28`}>
              Back
            </button>
            <button
              type="button"
              disabled={!isHydrated || isBusy}
              onClick={confirm}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isBusy ? "Saving…" : "Confirm"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!isHydrated || isBusy || !request}
            onClick={async () => setPreview(await call("/preview"))}
            className={PRIMARY_BUTTON_CLASS}
          >
            {isBusy ? "Checking…" : "Preview change"}
          </button>
        )}
      </div>
    </div>
  );
}
