import { createAuthClient } from "better-auth/react";

/** Browser client for Better Auth; same origin, so no baseURL is needed. */
export const authClient = createAuthClient();
