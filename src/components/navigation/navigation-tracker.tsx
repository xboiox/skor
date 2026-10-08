"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { canGoBack, nextStack, parseStack } from "@/lib/nav-stack";

const KEY = "skor:nav";

/** Records in-app pages visited in this tab (sessionStorage), so Back knows if a Skor page is behind. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const stack = parseStack(sessionStorage.getItem(KEY));
      sessionStorage.setItem(KEY, JSON.stringify(nextStack(stack, pathname)));
    } catch {
      // storage unavailable: Back falls back to its fixed destination
    }
  }, [pathname]);
  return null;
}

export function hasInAppHistory(): boolean {
  try {
    return canGoBack(parseStack(sessionStorage.getItem(KEY)));
  } catch {
    return false;
  }
}
