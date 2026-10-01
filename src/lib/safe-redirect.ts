const DEFAULT_PATH = "/dashboard";

/** Only same-site absolute paths are allowed after sign-in (prevents open redirects). */
export function safeRedirectPath(path: string | null | undefined, fallback = DEFAULT_PATH): string {
  if (!path || !path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
