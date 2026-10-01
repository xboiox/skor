import { headers } from "next/headers";
import { getAuth, type AuthSession } from "./auth";

/** Current Better Auth session for Server Components and route handlers, or null. */
export async function getCurrentSession(): Promise<AuthSession | null> {
  return getAuth().api.getSession({ headers: await headers() });
}
