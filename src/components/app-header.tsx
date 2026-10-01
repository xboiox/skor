import Link from "next/link";
import type { ReactNode } from "react";

interface AppHeaderProps {
  right?: ReactNode;
}

export function AppHeader({ right }: AppHeaderProps) {
  return (
    <header className="pt-safe border-border bg-surface border-b">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          Skor<span className="text-primary">.</span>
        </Link>
        {right}
      </div>
    </header>
  );
}
