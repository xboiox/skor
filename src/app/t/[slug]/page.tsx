import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppHeader } from "@/components/app-header";
import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { MatchCard } from "@/components/play/match-card";
import { LiveUpdates } from "@/components/realtime/live-updates";
import { TournamentNav } from "@/components/tournament/tournament-nav";
import { SegmentLinks } from "@/components/ui/segment-links";
import { AppError } from "@/lib/api-response";
import { formatDate, formatMatchType } from "@/lib/format";
import { currentIdentity } from "@/server/access/current-identity";
import { requireHost, requirePlayerLink } from "@/server/access/guards";
import { getAccessContext } from "@/server/http/request-context";
import { getTournamentBoard, type TournamentBoard } from "@/server/tournaments/board";
import { findLiveTournamentBySlug } from "@/server/tournaments/repository";
import { playerHistory, standingsOf } from "@/server/tournaments/standings";

/** One load per request, shared by generateMetadata and the page. */
const loadTournament = cache(async (slug: string) => {
  const ctx = await getAccessContext();
  const tournament = await findLiveTournamentBySlug(ctx.db, slug);
  const board = tournament ? await getTournamentBoard(ctx.db, tournament.id) : null;
  return { ctx, tournament, board };
});

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { board } = await loadTournament((await params).slug);
  return { title: board?.tournament.name ?? "Tournament not found", robots: { index: false } };
}

async function passes(check: Promise<unknown>): Promise<boolean> {
  try {
    await check;
    return true;
  } catch (err) {
    if (err instanceof AppError) return false;
    throw err;
  }
}

function Standings({
  board,
  view,
  meId,
}: {
  board: TournamentBoard;
  view: "live" | "final";
  meId: string | null;
}) {
  const { rows, usesAverage } = standingsOf(board, view === "final" ? "final" : "provisional");
  const histories = Object.fromEntries(
    board.players.map((p) => [p.id, playerHistory(board, p.id)]),
  );
  const hasProvisional = rows.some((r) => r.isProvisional);

  return (
    <section className="flex flex-col gap-3">
      <SegmentLinks
        label="Results to include"
        active={view}
        items={[
          { key: "live", label: "Live", href: `/t/${board.tournament.slug}` },
          { key: "final", label: "Final only", href: `/t/${board.tournament.slug}?view=final` },
        ]}
      />
      {usesAverage && (
        <p className="text-muted text-sm">
          Players have played different numbers of matches, so the ranking uses average points won
          per match.
        </p>
      )}
      <LeaderboardTable rows={rows} usesAverage={usesAverage} histories={histories} meId={meId} />
      {hasProvisional && (
        <p className="text-muted text-sm">⏱ live = includes scores not yet approved by the host.</p>
      )}
    </section>
  );
}

function Rounds({
  board,
  meId,
  isLinked,
}: {
  board: TournamentBoard;
  meId: string | null;
  isLinked: boolean;
}) {
  const names = new Map(board.players.map((p) => [p.id, p.name]));
  const ordered = [...board.rounds].sort((a, b) => {
    const rank = (s: string) => (s === "active" ? 0 : s === "pending" ? 1 : 2);
    return (
      rank(a.status) - rank(b.status) ||
      (a.status === "completed" ? b.number - a.number : a.number - b.number)
    );
  });
  return (
    <div className="flex flex-col gap-6">
      {ordered.map((round) => (
        <section key={round.id} className="flex flex-col gap-2">
          <h2 className="font-bold">
            Round {round.number}
            <span className="text-muted">
              {" "}
              ·{" "}
              {round.status === "active"
                ? "now"
                : round.status === "pending"
                  ? "upcoming"
                  : "finished"}
            </span>
          </h2>
          {round.matches.map((match) => (
            <MatchCard
              key={match.id}
              slug={board.tournament.slug}
              match={match}
              names={names}
              meId={meId}
              isLinked={isLinked}
            />
          ))}
          {round.byes.length > 0 && (
            <p className="text-muted text-sm">
              Sitting out: {round.byes.map((id) => names.get(id)).join(", ")}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

/** Public tournament page: live leaderboard and rounds, for anyone with the link. */
export default async function TournamentPage({ params, searchParams }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const tab = query.tab === "rounds" ? "rounds" : "board";
  const view = query.view === "final" ? "final" : "live";

  const { ctx, tournament, board } = await loadTournament(slug);
  if (!tournament || !board) notFound();

  const [meId, canPlay, isHost] = await Promise.all([
    currentIdentity(ctx, tournament),
    passes(requirePlayerLink(ctx, tournament)),
    passes(requireHost(ctx, tournament)),
  ]);
  const t = board.tournament;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader right={<LiveUpdates slug={slug} />} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        <div>
          <p className="text-muted text-sm font-semibold">
            {formatDate(t.date)} · {formatMatchType(t.matchType)} · {t.scoringLabel}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">{t.name}</h1>
        </div>

        {t.status === "draft" ? (
          <section className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-4">
            <h2 className="font-bold">Starting soon</h2>
            <p className="text-muted">{board.players.map((p) => p.name).join(", ")}</p>
          </section>
        ) : (
          <>
            {t.status === "finished" && (
              <p className="bg-accent text-accent-foreground rounded-xl px-4 py-3 font-bold">
                Final results
              </p>
            )}
            <SegmentLinks
              label="Tournament view"
              active={tab}
              items={[
                {
                  key: "board",
                  label: "Leaderboard",
                  href: `/t/${slug}${view === "final" ? "?view=final" : ""}`,
                },
                { key: "rounds", label: "Rounds", href: `/t/${slug}?tab=rounds` },
              ]}
            />
            {tab === "board" ? (
              <Standings board={board} view={view} meId={meId} />
            ) : (
              <Rounds board={board} meId={meId} isLinked={canPlay || isHost} />
            )}
          </>
        )}
      </main>
      <TournamentNav slug={slug} active="board" canPlay={canPlay} isHost={isHost} />
    </div>
  );
}
