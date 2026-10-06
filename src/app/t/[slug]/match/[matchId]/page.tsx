import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ScoringScreen } from "@/components/scoring/scoring-screen";
import { AppError } from "@/lib/api-response";
import { requireScorer } from "@/server/access/guards";
import { getAccessContext } from "@/server/http/request-context";
import { getTournamentBoard } from "@/server/tournaments/board";
import { findLiveTournamentBySlug } from "@/server/tournaments/repository";

export const metadata: Metadata = { title: "Score", robots: { index: false } };

export default async function MatchPage({ params }: PageProps<"/t/[slug]/match/[matchId]">) {
  const { slug, matchId } = await params;
  if (!z.uuid().safeParse(matchId).success) notFound();

  const ctx = await getAccessContext();
  const tournament = await findLiveTournamentBySlug(ctx.db, slug);
  if (!tournament) notFound();

  try {
    await requireScorer(ctx, tournament);
  } catch (err) {
    // Player link without a chosen identity (or no access): the play page explains what to do.
    if (err instanceof AppError) redirect(`/t/${slug}/play`);
    throw err;
  }

  const board = (await getTournamentBoard(ctx.db, tournament.id))!;
  const round = board.rounds.find((r) => r.matches.some((m) => m.id === matchId));
  const match = round?.matches.find((m) => m.id === matchId);
  if (!round || !match) notFound();

  const names = new Map(board.players.map((p) => [p.id, p.name]));
  const team = (ids: readonly [string, string]) =>
    ids.map((id) => names.get(id) ?? "?").join(" / ");

  return (
    <ScoringScreen
      slug={slug}
      match={match}
      roundNumber={round.number}
      config={board.scoring}
      teamNames={{ A: team(match.teamA), B: team(match.teamB) }}
    />
  );
}
