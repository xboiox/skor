import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftManager } from "@/components/admin/draft-manager";
import { AppHeader } from "@/components/app-header";
import { LinkCard } from "@/components/share/link-card";
import { AppError } from "@/lib/api-response";
import { formatDate, formatMatchType, formatScoring } from "@/lib/format";
import { getPlayerToken } from "@/server/access/access-repository";
import { requireHost } from "@/server/access/guards";
import { getEnv } from "@/server/env";
import { getAccessContext } from "@/server/http/request-context";
import { tournamentLinks } from "@/server/tournaments/links";
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

  const overview = (await getTournamentOverview(ctx.db, tournament.id))!;
  const t = overview.tournament;
  const links = tournamentLinks(getEnv().APP_URL, slug, {
    admin: null,
    player: await getPlayerToken(ctx.db, tournament.id),
  });

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
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
          />
        )}

        {t.status === "draft" ? (
          <DraftManager tournamentId={t.id} players={overview.players} />
        ) : (
          <section className="border-border bg-surface rounded-xl border p-4">
            <h2 className="font-bold">
              {t.status === "active" ? "Tournament started" : "Tournament finished"}
            </h2>
            <p className="text-muted">
              {overview.roundCount} {overview.roundCount === 1 ? "round" : "rounds"} scheduled for{" "}
              {overview.players.length} players.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
