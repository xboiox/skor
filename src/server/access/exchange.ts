import { z } from "zod";
import type { Database } from "@/server/db/client";
import { verifyAccessToken } from "./access-repository";
import {
  accessCookieName,
  accessCookieOptions,
  type AccessRole,
  type CookieOptions,
} from "./tokens";

const linkSchema = z.object({
  slug: z.string().min(1).max(64),
  role: z.enum(["admin", "player"]),
  token: z.string().min(1).max(128),
});

const LANDING: Record<AccessRole, string> = { admin: "admin", player: "play" };

export type AccessExchange = {
  readonly redirectTo: string;
  readonly cookie: {
    readonly name: string;
    readonly value: string;
    readonly options: CookieOptions;
  };
};

/**
 * Verifies a shared link (`/t/{slug}/enter/{role}?k=token`). On success the token moves into an
 * httpOnly cookie and the browser is sent to a URL without it, so it never sits in history.
 */
export async function exchangeAccessLink(
  db: Database,
  input: { slug: string; role: string; token: string; isSecure: boolean },
): Promise<AccessExchange | null> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return null;
  const { slug, role, token } = parsed.data;

  const tournament = await verifyAccessToken(db, slug, role, token);
  if (!tournament) return null;

  return {
    redirectTo: `/t/${tournament.slug}/${LANDING[role]}`,
    cookie: {
      name: accessCookieName(role, tournament.slug),
      value: token,
      options: accessCookieOptions({ expiresAt: tournament.expiresAt, isSecure: input.isSecure }),
    },
  };
}
