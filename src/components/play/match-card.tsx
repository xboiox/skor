import Link from "next/link";
import type { MatchView } from "@/server/matches/view";

interface MatchCardProps {
  slug: string;
  match: MatchView;
  names: ReadonlyMap<string, string>;
  meId: string | null;
  /** Public viewers see the card without a link to the scoring screen. */
  isLinked?: boolean;
}

export const MATCH_STATUS_LABEL = {
  scheduled: "Not started",
  in_progress: "Live",
  submitted: "Awaiting approval",
  approved: "Final",
} as const;

export function MatchCard({ slug, match, names, meId, isLinked = true }: MatchCardProps) {
  const isMine = meId !== null && [...match.teamA, ...match.teamB].includes(meId);
  const team = (ids: readonly [string, string]) =>
    ids.map((id) => names.get(id) ?? "?").join(" / ");
  const hasScore = match.status !== "scheduled";

  const className = `bg-surface flex flex-col gap-1 rounded-xl border p-4 ${isMine ? "border-primary border-2" : "border-border"}`;
  const content = (
    <>
      <span className="text-muted flex items-center justify-between text-sm font-semibold">
        <span>
          Court {match.court}
          {isMine && (
            <span className="bg-accent text-accent-foreground ml-2 rounded-full px-2 py-0.5">
              You
            </span>
          )}
        </span>
        <span className={match.status === "in_progress" ? "text-success" : undefined}>
          {MATCH_STATUS_LABEL[match.status]}
        </span>
      </span>
      <span className="flex items-center justify-between gap-3 font-semibold">
        <span>{team(match.teamA)}</span>
        {hasScore && <span className="tabular text-xl font-extrabold">{match.scoreA}</span>}
      </span>
      <span className="flex items-center justify-between gap-3 font-semibold">
        <span>{team(match.teamB)}</span>
        {hasScore && <span className="tabular text-xl font-extrabold">{match.scoreB}</span>}
      </span>
    </>
  );
  return isLinked ? (
    <Link href={`/t/${slug}/match/${match.id}`} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
