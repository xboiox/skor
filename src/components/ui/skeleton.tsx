import { AppHeader } from "@/components/app-header";

interface SkeletonProps {
  className?: string;
}

/** A grey placeholder block; the pulse stops when the user prefers reduced motion (globals.css). */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div aria-hidden="true" className={`bg-border/70 animate-pulse rounded-xl ${className}`} />
  );
}

interface PageSkeletonProps {
  /** list: cards (dashboard, matches, leaderboard); form: fields (create, login); scoring: two big panels. */
  variant?: "list" | "form" | "scoring";
  /** Room for a sticky bottom bar (tab bar or primary button) so the layout does not jump. */
  hasBottomBar?: boolean;
}

/**
 * Instant feedback while the server renders the next page (`loading.tsx`).
 * Mirrors the real layout so content does not jump when it arrives.
 */
export function PageSkeleton({ variant = "list", hasBottomBar = false }: PageSkeletonProps) {
  if (variant === "scoring") {
    return (
      <div role="status" aria-label="Loading" className="flex h-dvh flex-col">
        <span className="sr-only">Loading…</span>
        <Skeleton className="m-2 h-12 rounded-lg" />
        <Skeleton className="mx-2 flex-1 rounded-2xl" />
        <Skeleton className="m-2 flex-1 rounded-2xl" />
        <Skeleton className="m-2 h-14" />
      </div>
    );
  }

  return (
    <div role="status" aria-label="Loading" className="flex flex-1 flex-col">
      <span className="sr-only">Loading…</span>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-3/4" />
        {variant === "form" ? (
          <>
            <Skeleton className="mt-2 h-4 w-28" />
            <Skeleton className="h-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-12" />
          </>
        ) : (
          <>
            <Skeleton className="h-12" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        )}
      </div>
      {hasBottomBar && (
        <div className="pb-safe border-border bg-surface sticky bottom-0 border-t px-4 pt-3">
          <Skeleton className="mx-auto h-14 max-w-2xl" />
        </div>
      )}
    </div>
  );
}
