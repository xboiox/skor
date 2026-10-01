import { and, eq } from "drizzle-orm";
import type { Database, Executor } from "@/server/db/client";
import { accessTokens, tournaments } from "@/server/db/schema";
import { isLive, type TournamentRef } from "@/server/tournaments/repository";
import { getEnv } from "@/server/env";
import { decryptToken, encryptToken } from "./token-crypto";
import { generateToken, hashToken, type AccessRole } from "./tokens";

export type IssuedTokens = { readonly admin: string; readonly player: string };

/**
 * Creates (or rotates) the admin and player tokens and returns them once.
 * Both are looked up by hash. Only the player token is also kept encrypted, so the
 * player link can be shown again; the admin link cannot be recovered.
 */
export async function issueAccessTokens(
  db: Executor,
  tournamentId: string,
  secret: string = getEnv().AUTH_SECRET,
): Promise<IssuedTokens> {
  const issued: IssuedTokens = { admin: generateToken(), player: generateToken() };
  const roles: AccessRole[] = ["admin", "player"];
  for (const role of roles) {
    const values = {
      tokenHash: hashToken(issued[role]),
      tokenCiphertext: role === "player" ? encryptToken(issued.player, secret) : null,
      createdAt: new Date(),
    };
    await db
      .insert(accessTokens)
      .values({ tournamentId, role, ...values })
      .onConflictDoUpdate({ target: [accessTokens.tournamentId, accessTokens.role], set: values });
  }
  return issued;
}

/** The current player token, or null (unknown tournament, or AUTH_SECRET changed since it was issued). */
export async function getPlayerToken(
  db: Database,
  tournamentId: string,
  secret: string = getEnv().AUTH_SECRET,
): Promise<string | null> {
  const [row] = await db
    .select({ ciphertext: accessTokens.tokenCiphertext })
    .from(accessTokens)
    .where(and(eq(accessTokens.tournamentId, tournamentId), eq(accessTokens.role, "player")))
    .limit(1);
  return row?.ciphertext ? decryptToken(row.ciphertext, secret) : null;
}

export async function verifyAccessToken(
  db: Database,
  slug: string,
  role: AccessRole,
  token: string,
): Promise<TournamentRef | null> {
  const [row] = await db
    .select({
      id: tournaments.id,
      slug: tournaments.slug,
      ownerId: tournaments.ownerId,
      expiresAt: tournaments.expiresAt,
    })
    .from(accessTokens)
    .innerJoin(tournaments, eq(tournaments.id, accessTokens.tournamentId))
    .where(
      and(
        eq(tournaments.slug, slug),
        eq(accessTokens.role, role),
        eq(accessTokens.tokenHash, hashToken(token)),
        isLive(),
      ),
    )
    .limit(1);
  return row ?? null;
}
