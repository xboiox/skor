"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { hasInAppHistory } from "./navigation-tracker";

interface BackButtonProps {
  /** Where to go when no Skor page is behind (opened from a shared link) — or before hydration. */
  fallbackHref: string;
  label?: string;
  showArrow?: boolean;
  className?: string;
}

const DEFAULT_CLASS = "text-primary -mr-2 flex min-h-12 items-center px-2 font-semibold";

/** "← Back": the previous Skor page if there is one, otherwise `fallbackHref`. */
export function BackButton({
  fallbackHref,
  label = "Back",
  showArrow = true,
  className = DEFAULT_CLASS,
}: BackButtonProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!hasInAppHistory()) return; // follow the link to the fallback
    event.preventDefault();
    router.back();
  }

  return (
    <Link href={fallbackHref} onClick={handleClick} className={className}>
      {showArrow ? `← ${label}` : label}
    </Link>
  );
}
