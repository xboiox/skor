import { headers } from "next/headers";
import { getAuth, type AuthSession } from "./auth";

/** Current Better Auth session for Server Components and route handlers, or null. */
export async function getCurrentSession(): Promise<AuthSession | null> {
  // Read the request first: it marks the page as dynamic before any env/config is touched,
  // so `next build` never tries to prerender session pages (and needs no secrets at build time).
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
}
