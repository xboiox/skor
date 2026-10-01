import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PRIMARY_BUTTON_CLASS } from "@/components/ui/styles";
import { formatDate, formatMatchType } from "@/lib/format";
import { getCurrentSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listOwnedTournaments } from "@/server/tournaments/queries";

export const metadata: Metadata = { title: "My tournaments" };

const STATUS_LABEL = { draft: "Draft", active: "Live", finished: "Finished" } as const;

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/dashboard");
  const tournaments = await listOwnedTournaments(getDb(), session.user.id);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader right={<SignOutButton />} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <p className="text-muted [overflow-wrap:anywhere]">Signed in as {session.user.email}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Hi, {session.user.name}</h1>
        </div>

        {tournaments.length === 0 ? (
          <section className="border-border bg-surface rounded-xl border p-6 text-center">
            <h2 className="text-lg font-bold">No tournaments yet</h2>
            <p className="text-muted">Tournaments you create while signed in are saved here.</p>
          </section>
        ) : (
          <section className="flex flex-col gap-3">
            <h2 className="font-bold">My tournaments</h2>
            <ul className="flex flex-col gap-2">
              {tournaments.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/t/${t.slug}/admin`}
                    className="border-border bg-surface flex min-h-16 items-center justify-between gap-3 rounded-xl border px-4 py-3"
                  >
                    <span className="flex flex-col">
                      <span className="font-bold">{t.name}</span>
                      <span className="text-muted text-sm">
                        {formatDate(t.date)} · {formatMatchType(t.matchType)} · {t.playerCount}{" "}
                        players
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                        t.status === "active"
                          ? "bg-accent text-accent-foreground"
                          : "border-border text-muted border"
                      }`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="pb-safe border-border bg-surface/95 sticky bottom-0 border-t px-4 pt-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Link href="/tournaments/new" className={PRIMARY_BUTTON_CLASS}>
            Create tournament
          </Link>
        </div>
      </footer>
    </div>
  );
}
