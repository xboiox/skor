import Link from "next/link";
import { LinkCard } from "@/components/share/link-card";
import { PRIMARY_BUTTON_CLASS } from "@/components/ui/styles";

export type CreatedTournament = {
  slug: string;
  isGuest: boolean;
  links: { admin: string | null; player: string | null; public: string };
};

interface CreatedScreenProps {
  name: string;
  created: CreatedTournament;
}

export function CreatedScreen({ name, created }: CreatedScreenProps) {
  const { links, isGuest } = created;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-success font-bold">✓ Tournament created</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{name}</h1>
      </div>

      {isGuest && (
        <p
          role="note"
          className="border-danger bg-surface rounded-xl border-2 px-4 py-3 font-semibold"
        >
          Save your admin link now. Without an account it is the only way to manage this tournament,
          and it will not be shown again.
          <span className="text-muted mt-1 block text-sm font-normal">
            Next time,{" "}
            <Link href="/login" className="text-primary font-bold">
              log in first
            </Link>{" "}
            and you won&apos;t need this link — your tournaments stay in your dashboard.
          </span>
        </p>
      )}

      {links.admin && (
        <LinkCard
          title="Admin link (you)"
          description="Manage players, start rounds and approve scores. Keep it private."
          url={links.admin}
          shareText={`${name} — admin`}
        />
      )}
      {links.player && (
        <LinkCard
          title="Player link"
          description="Send to the players so they can enter scores."
          url={links.player}
          shareText={`${name} — join to enter scores`}
        />
      )}
      <LinkCard
        title="Public link"
        description="Anyone can follow live scores and the leaderboard."
        url={links.public}
        shareText={`${name} — live scores`}
      />

      {links.admin && (
        <a href={links.admin} className={PRIMARY_BUTTON_CLASS}>
          Open tournament
        </a>
      )}
    </div>
  );
}
