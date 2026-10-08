import type { Metadata } from "next";
import { CreateTournamentWizard } from "@/components/tournament-form/wizard";
import { getCurrentSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const session = await getCurrentSession();
  // Server date as a default; the host can change it in the form.
  const today = new Date().toISOString().slice(0, 10);

  // The wizard renders its own header so Back can hide on the "created" screen.
  return <CreateTournamentWizard today={today} isSignedIn={Boolean(session)} />;
}
