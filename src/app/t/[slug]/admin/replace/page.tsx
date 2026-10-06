import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReplaceWizard } from "@/components/admin/replace-wizard";
import { AppHeader } from "@/components/app-header";
import { AppError } from "@/lib/api-response";
import { requireHost } from "@/server/access/guards";
import { getAccessContext } from "@/server/http/request-context";
import { getTournamentBoard } from "@/server/tournaments/board";
import { findLiveTournamentBySlug } from "@/server/tournaments/repository";

export const metadata: Metadata = { title: "Replace a player", robots: { index: false } };

export default async function ReplacePage({ params }: PageProps<"/t/[slug]/admin/replace">) {
  const { slug } = await params;
  const ctx = await getAccessContext();
  const tournament = await findLiveTournamentBySlug(ctx.db, slug);
  if (!tournament) notFound();
  try {
    await requireHost(ctx, tournament);
  } catch (err) {
    if (err instanceof AppError) redirect(`/t/${slug}/admin`);
    throw err;
  }

  const board = (await getTournamentBoard(ctx.db, tournament.id))!;
  if (board.tournament.status !== "active") redirect(`/t/${slug}/admin`);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        right={
          <Link
            href={`/t/${slug}/admin`}
            className="text-primary flex min-h-12 items-center px-3 font-semibold"
          >
            Cancel
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Replace a player</h1>
        <ReplaceWizard board={board} />
      </main>
    </div>
  );
}
