import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { getEnv, isGoogleAuthEnabled } from "@/server/env";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const SESSION_DAYS = 30;
const DAY_SECONDS = 24 * 60 * 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 100;

function createAuth() {
  const env = getEnv();
  return betterAuth({
    appName: "Skor",
    baseURL: env.APP_URL,
    secret: env.AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      autoSignIn: true,
    },
    socialProviders: isGoogleAuthEnabled(env)
      ? { google: { clientId: env.AUTH_GOOGLE_ID!, clientSecret: env.AUTH_GOOGLE_SECRET! } }
      : {},
    session: { expiresIn: SESSION_DAYS * DAY_SECONDS },
    // Sign-in/up keep Better Auth's stricter built-in rule (3 requests / 10 s per IP).
    rateLimit: { enabled: true, window: RATE_LIMIT_WINDOW_SECONDS, max: RATE_LIMIT_MAX },
    advanced: {
      database: { generateId: "uuid" },
      // Same client-IP rules as our own API (docs/SECURITY.md): the header written by the proxy,
      // walking X-Forwarded-For past the trusted proxy hops.
      ipAddress: {
        ipAddressHeaders: [env.CLIENT_IP_HEADER],
        ...(env.TRUSTED_PROXIES.length > 0 ? { trustedProxies: env.TRUSTED_PROXIES } : {}),
      },
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

// Per module (not global) so it follows the current Drizzle instance after hot reloads.
let auth: Auth | undefined;

/** Created lazily so importing this module never needs env vars (e.g. during `next build`). */
export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}
