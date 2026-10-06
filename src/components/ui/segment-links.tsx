import Link from "next/link";

interface SegmentLinksProps {
  label: string;
  items: readonly { key: string; label: string; href: string }[];
  active: string;
}

/** Segmented control made of links, so the choice lives in the URL (shareable, back button works). */
export function SegmentLinks({ label, items, active }: SegmentLinksProps) {
  return (
    <nav
      aria-label={label}
      className="bg-surface grid grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-1 rounded-xl p-1"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          replace
          scroll={false}
          className={`flex min-h-12 items-center justify-center rounded-lg font-bold ${
            item.key === active ? "bg-primary text-primary-foreground" : "text-muted"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
