import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { LiveUpdates } from "@/components/realtime/live-updates";
import { IdentityPicker } from "@/components/play/identity-picker";
import { PlayView } from "@/components/play/play-view";
import { TournamentNav } from "@/components/tournament/tournament-nav";
import { AppError } from "@/lib/api-response";
import { formatMatchType } from "@/lib/format";
import { currentIdentity } from "@/server/access/current-identity";
import { requireHost, requirePlayerLink } from "@/server/access/guards";
import { getAccessContext } from "@/server/http/request-context";
import { getTournamentBoard } from "@/server/tournaments/board";
import { findLiveTournamentBySlug } from "@/server/tournaments/repository";

export const metadata: Metadata = { title: "Matches", robots: { index: false } };

async function isAllowed(check: Promise<unknown>): Promise<boolean> {
  try {
    await check;
    return true;
  } catch (err) {
    if (err instanceof AppError) return false;
    throw err;
  }
}

export default async function PlayPage({ params }: PageProps<"/t/[slug]/play">) {
  const { slug } = await params;
  const ctx = await getAccessContext();
  const tournament = await findLiveTournamentBySlug(ctx.db, slug);
  if (!tournament) notFound();

  if (!(await isAllowed(requirePlayerLink(ctx, tournament)))) {
    return (
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Players only</h1>
          <p className="text-muted">
            Open the player link from the host to see your matches and enter scores.
          </p>
        </main>
      </div>
    );
  }

  const [board, meId, isHost] = await Promise.all([
    getTournamentBoard(ctx.db, tournament.id),
    currentIdentity(ctx, tournament),
    isAllowed(requireHost(ctx, tournament)),
  ]);
  const t = board!.tournament;
  const activePlayers = board!.players.filter((p) => p.status === "active");

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader right={<LiveUpdates slug={slug} />} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
        <div>
          <p className="text-muted text-sm font-semibold">
            {formatMatchType(t.matchType)} · {t.scoringLabel}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">{t.name}</h1>
        </div>
        {t.status === "draft" ? (
          <p className="border-border bg-surface rounded-xl border p-4 font-semibold">
            Waiting for the host to start the tournament.
          </p>
        ) : meId ? (
          <PlayView board={board!} meId={meId} />
        ) : (
          <IdentityPicker slug={slug} players={activePlayers} />
        )}
      </main>
      <TournamentNav slug={slug} active="play" canPlay isHost={isHost} />
    </div>
  );
}
