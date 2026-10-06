import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftManager } from "@/components/admin/draft-manager";
import { ResultsPanel } from "@/components/admin/results-panel";
import { TournamentControls } from "@/components/admin/tournament-controls";
import { TournamentNav } from "@/components/tournament/tournament-nav";
import { AppHeader } from "@/components/app-header";
import { LiveUpdates } from "@/components/realtime/live-updates";
import { LinkCard } from "@/components/share/link-card";
import { AppError } from "@/lib/api-response";
import { formatDate, formatFinalHint, formatMatchType, formatScoring } from "@/lib/format";
import { getPlayerToken } from "@/server/access/access-repository";
import { requireHost } from "@/server/access/guards";
import { getEnv } from "@/server/env";
import { getAccessContext } from "@/server/http/request-context";
import { qrSvg } from "@/server/share/qr";
import { tournamentLinks } from "@/server/tournaments/links";
import { getTournamentBoard } from "@/server/tournaments/board";
import { getTournamentOverview } from "@/server/tournaments/queries";
import { findLiveTournamentBySlug } from "@/server/tournaments/repository";

export const metadata: Metadata = { title: "Manage tournament", robots: { index: false } };

function NoAccess({ slug }: { slug: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Host only</h1>
      <p className="text-muted">
        Open the admin link you received when the tournament was created, or log in with the account
        that created it.
      </p>
      <Link href={`/login?next=/t/${slug}/admin`} className="text-primary font-semibold">
        Log in
      </Link>
    </main>
  );
}

export default async function AdminPage({ params }: PageProps<"/t/[slug]/admin">) {
  const { slug } = await params;
  const ctx = await getAccessContext();
  const tournament = await findLiveTournamentBySlug(ctx.db, slug);
  if (!tournament) notFound();

  try {
    await requireHost(ctx, tournament);
  } catch (err) {
    if (err instanceof AppError) {
      return (
        <div className="flex flex-1 flex-col">
          <AppHeader />
          <NoAccess slug={slug} />
        </div>
      );
    }
    throw err;
  }

  const [overviewResult, board] = await Promise.all([
    getTournamentOverview(ctx.db, tournament.id),
    getTournamentBoard(ctx.db, tournament.id),
  ]);
  const overview = overviewResult!;
  const t = overview.tournament;
  const links = tournamentLinks(getEnv().APP_URL, slug, {
    admin: null,
    player: await getPlayerToken(ctx.db, tournament.id),
  });

  const [playerQr, publicQr] = await Promise.all([
    links.player ? qrSvg(links.player) : Promise.resolve(undefined),
    qrSvg(links.public),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader right={<LiveUpdates slug={slug} />} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-6">
        <div>
          <p className="text-muted text-sm font-semibold">
            {formatDate(t.date)} · {formatMatchType(t.matchType)} · {t.courts}{" "}
            {t.courts === 1 ? "court" : "courts"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">{t.name}</h1>
          <p className="text-muted">{formatScoring(t)}</p>
        </div>

        {links.player && (
          <LinkCard
            title="Player link"
            description="Players open this to enter scores."
            url={links.player}
            shareText={`${t.name} — join to enter scores`}
            qrSvg={playerQr}
          />
        )}

        <LinkCard
          title="Public link"
          description="Anyone can follow live scores and the leaderboard."
          url={links.public}
          shareText={`${t.name} — live scores`}
          qrSvg={publicQr}
        />

        {t.status === "draft" ? (
          <DraftManager tournamentId={t.id} players={overview.players} />
        ) : (
          <>
            {t.status === "finished" && (
              <p className="border-border bg-surface rounded-xl border p-4 font-semibold">
                This tournament has ended. Results are final.
              </p>
            )}
            <TournamentControls board={board!} />
            <ResultsPanel board={board!} finalHint={formatFinalHint(board!.scoring)} />
          </>
        )}
      </main>
      {t.status !== "draft" && <TournamentNav slug={slug} active="admin" canPlay isHost />}
    </div>
  );
}
