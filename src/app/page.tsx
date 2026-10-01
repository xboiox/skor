import Link from "next/link";
import { AppHeader } from "@/components/app-header";

const FEATURES = [
  { title: "Auto schedule", body: "Fair partner rotation across every court, byes included." },
  { title: "Live scores", body: "Players score from their phones. Everyone sees it instantly." },
  { title: "Live leaderboard", body: "Points won, diff and head-to-head — always up to date." },
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        right={
          <Link
            href="/login"
            className="text-primary flex min-h-12 items-center rounded-lg px-3 font-semibold"
          >
            Log in
          </Link>
        }
      />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8">
        <section className="flex flex-col gap-3">
          <p className="bg-accent text-accent-foreground w-fit rounded-full px-3 py-1 text-sm font-bold">
            Americano · Mexicano
          </p>
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight">
            Padel tournaments, scored live.
          </h1>
          <p className="text-muted text-lg">
            Create a tournament in under two minutes. No account needed.
          </p>
        </section>

        <ul className="flex flex-col gap-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="border-border bg-surface rounded-xl border p-4">
              <h2 className="font-bold">{feature.title}</h2>
              <p className="text-muted">{feature.body}</p>
            </li>
          ))}
        </ul>
      </main>

      <footer className="pb-safe border-border bg-surface/95 sticky bottom-0 border-t px-4 pt-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/tournaments/new"
            className="bg-primary text-primary-foreground flex min-h-14 w-full items-center justify-center rounded-xl text-lg font-bold"
          >
            Create tournament
          </Link>
        </div>
      </footer>
    </div>
  );
}
