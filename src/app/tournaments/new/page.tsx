import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { CreateTournamentWizard } from "@/components/tournament-form/wizard";
import { getCurrentSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const session = await getCurrentSession();
  // Server date as a default; the host can change it in the form.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6">
        <CreateTournamentWizard today={today} isSignedIn={Boolean(session)} />
      </main>
    </div>
  );
}
