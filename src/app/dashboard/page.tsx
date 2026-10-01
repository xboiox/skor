import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "My tournaments" };

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/dashboard");

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader right={<SignOutButton />} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <div>
          <p className="text-muted [overflow-wrap:anywhere]">Signed in as {session.user.email}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Hi, {session.user.name}</h1>
        </div>
        {/* Tournament list arrives in Fase 6. */}
        <section className="border-border bg-surface rounded-xl border p-6 text-center">
          <h2 className="text-lg font-bold">No tournaments yet</h2>
          <p className="text-muted">Tournaments you create while signed in are saved here.</p>
        </section>
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
