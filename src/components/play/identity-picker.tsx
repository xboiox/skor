"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FieldError } from "@/components/ui/field-error";
import { INPUT_CLASS } from "@/components/ui/styles";
import { useHydrated } from "@/hooks/use-hydrated";
import { apiRequest } from "@/lib/api-client";

interface IdentityPickerProps {
  slug: string;
  players: readonly { id: string; name: string }[];
}

const SEARCH_THRESHOLD = 12;

/** "I am …" — a big list instead of a tiny <select> (docs/UI_GUIDELINES.md §5.3). */
export function IdentityPicker({ slug, players }: IdentityPickerProps) {
  const router = useRouter();
  const isHydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);

  const visible = players.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function choose(playerId: string) {
    setChoosing(playerId);
    setError(null);
    const result = await apiRequest(`/api/t/${slug}/identity`, {
      method: "POST",
      body: { playerId },
    });
    setChoosing(null);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-extrabold">Who are you?</h2>
      <p className="text-muted">
        Pick your name so your matches show first. You can score any match.
      </p>
      {players.length > SEARCH_THRESHOLD && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search your name"
          aria-label="Search your name"
          className={INPUT_CLASS}
        />
      )}
      <FieldError message={error ?? undefined} />
      <ul className="flex flex-col gap-2">
        {visible.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              disabled={!isHydrated || choosing !== null}
              onClick={() => choose(player.id)}
              className="border-border bg-surface flex min-h-14 w-full items-center rounded-xl border px-4 text-left text-lg font-bold disabled:opacity-60"
            >
              {choosing === player.id ? "Saving…" : `I am ${player.name}`}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
