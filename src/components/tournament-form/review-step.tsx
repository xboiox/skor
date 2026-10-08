import Link from "next/link";
import { formatDate, formatMatchType, formatScoring } from "@/lib/format";
import type { FormState } from "./form-state";

interface ReviewStepProps {
  state: FormState;
  errors: Record<string, string>;
  isSignedIn: boolean;
}

export function ReviewStep({ state, errors, isSignedIn }: ReviewStepProps) {
  const scoring = formatScoring({
    scoringType: state.scoringType,
    rallyPoints: state.totalPoints,
    tennisMode: state.tennisMode,
    tennisGames: state.tennisGames,
    deuceRule: state.deuce,
  });
  const rows: [string, string][] = [
    ["Name", state.name || "—"],
    ["Date", state.date ? formatDate(state.date) : "—"],
    [
      "Format",
      `${formatMatchType(state.matchType)} · ${state.courts} ${state.courts === 1 ? "court" : "courts"}`,
    ],
    ["Scoring", scoring],
    ["Players", `${state.players.length}: ${state.players.join(", ")}`],
  ];
  const problems = Object.values(errors);

  return (
    <div className="flex flex-col gap-4">
      <dl className="divide-border border-border bg-surface flex flex-col divide-y rounded-xl border">
        {rows.map(([term, detail]) => (
          <div key={term} className="flex flex-col gap-0.5 px-4 py-3">
            <dt className="text-muted text-sm">{term}</dt>
            <dd className="font-semibold">{detail}</dd>
          </div>
        ))}
      </dl>
      {problems.length > 0 && (
        <ul
          role="alert"
          className="border-danger text-danger rounded-xl border px-4 py-3 font-medium"
        >
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {isSignedIn ? (
        <p className="text-muted text-sm">This tournament is saved to your account.</p>
      ) : (
        <div className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-4">
          <p className="font-semibold">
            You are not signed in: this tournament and its links are deleted after 7 days.
          </p>
          <p className="text-muted text-sm">
            Log in first to keep it and manage it from any phone. Your answers stay here.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent("/tournaments/new")}`}
            className="text-primary flex min-h-12 items-center font-bold"
          >
            Log in to keep it →
          </Link>
        </div>
      )}
    </div>
  );
}
