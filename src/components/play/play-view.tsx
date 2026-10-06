"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { apiRequest } from "@/lib/api-client";
import type { TournamentBoard } from "@/server/tournaments/board";
import { MatchCard } from "./match-card";

interface PlayViewProps {
  board: TournamentBoard;
  meId: string;
}

/** Match list for one player: their next match pinned on top, then rounds in play order. */
export function PlayView({ board, meId }: PlayViewProps) {
  const router = useRouter();
  const { slug } = board.tournament;
  const names = new Map(board.players.map((p) => [p.id, p.name]));

  // Until live updates (Fase 8), refresh when the player comes back to the app.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const open = board.rounds.filter((r) => r.status !== "completed");
  const done = board.rounds.filter((r) => r.status === "completed").reverse();
  const myNext = open
    .flatMap((r) => r.matches.map((m) => ({ round: r.number, match: m })))
    .find(
      ({ match }) => match.status !== "approved" && [...match.teamA, ...match.teamB].includes(meId),
    );

  async function forgetMe() {
    await apiRequest(`/api/t/${slug}/identity`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="font-semibold">
          You: <span className="text-primary">{names.get(meId)}</span>
        </p>
        <button
          type="button"
          onClick={forgetMe}
          className="text-primary min-h-12 px-2 font-semibold"
        >
          Not you?
        </button>
      </div>

      {myNext && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">Your next match · Round {myNext.round}</h2>
          <MatchCard slug={slug} match={myNext.match} names={names} meId={meId} />
        </section>
      )}

      {open.map((round) => (
        <section key={round.id} className="flex flex-col gap-2">
          <h2 className="font-bold">
            Round {round.number}
            {round.leg === 2 && <span className="text-muted"> · second leg</span>}
          </h2>
          {round.matches.map((match) => (
            <MatchCard key={match.id} slug={slug} match={match} names={names} meId={meId} />
          ))}
          {round.byes.length > 0 && (
            <p className="text-muted text-sm">
              Sitting out: {round.byes.map((id) => names.get(id)).join(", ")}
            </p>
          )}
        </section>
      ))}

      {done.length > 0 && (
        <details className="border-border bg-surface rounded-xl border p-4">
          <summary className="min-h-8 font-bold">Finished rounds ({done.length})</summary>
          <div className="mt-3 flex flex-col gap-4">
            {done.map((round) => (
              <section key={round.id} className="flex flex-col gap-2">
                <h3 className="font-semibold">Round {round.number}</h3>
                {round.matches.map((match) => (
                  <MatchCard key={match.id} slug={slug} match={match} names={names} meId={meId} />
                ))}
              </section>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
