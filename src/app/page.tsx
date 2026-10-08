import Link from "next/link";
import { AppHeader } from "@/components/app-header";

const ACCOUNT_BENEFITS = [
  "Tournaments are saved — guest tournaments are deleted after 7 days",
  "Manage from any phone — no admin link to keep safe",
  "All your tournaments in one dashboard",
] as const;

const FEATURES = [
  {
    title: "Auto schedule",
    body: "Fair partner rotation across every court, byes included. Swap in a substitute if someone can't play.",
  },
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
          <p className="text-muted text-lg">Create a tournament in under two minutes.</p>
        </section>

        <ul className="flex flex-col gap-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="border-border bg-surface rounded-xl border p-4">
              <h2 className="font-bold">{feature.title}</h2>
              <p className="text-muted">{feature.body}</p>
            </li>
          ))}
        </ul>

        <section
          aria-labelledby="account-benefits"
          className="border-primary bg-surface flex flex-col gap-3 rounded-xl border-2 p-4"
        >
          <h2 id="account-benefits" className="text-lg font-extrabold">
            Free account, more control
          </h2>
          <ul className="flex flex-col gap-2">
            {ACCOUNT_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex gap-2">
                <span aria-hidden="true" className="text-success font-bold">
                  ✓
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/register"
            className="border-border flex min-h-12 items-center justify-center rounded-xl border font-bold"
          >
            Create free account
          </Link>
        </section>
      </main>

      <footer className="pb-safe border-border bg-surface sticky bottom-0 border-t px-4 pt-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <p className="text-muted text-center text-sm">
            Or just create a tournament as a guest — no account needed.
          </p>
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
