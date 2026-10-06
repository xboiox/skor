import Link from "next/link";

interface TournamentNavProps {
  slug: string;
  active: "play" | "admin";
  isHost: boolean;
}

/** Bottom tab bar for tournament screens (docs/UI_GUIDELINES.md §4). */
export function TournamentNav({ slug, active, isHost }: TournamentNavProps) {
  const tabs = [
    { key: "play", label: "Matches", href: `/t/${slug}/play` },
    ...(isHost ? [{ key: "admin", label: "Admin", href: `/t/${slug}/admin` }] : []),
  ] as const;
  if (tabs.length < 2) return null;

  return (
    <nav
      aria-label="Tournament"
      className="pb-safe border-border bg-surface sticky bottom-0 z-10 border-t"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => (
          <li key={tab.key} className="flex-1">
            <Link
              href={tab.href}
              aria-current={tab.key === active ? "page" : undefined}
              className={`flex min-h-14 items-center justify-center font-bold ${
                tab.key === active ? "text-primary" : "text-muted"
              }`}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
