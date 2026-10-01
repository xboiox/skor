import { and, eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { accessTokens, tournaments } from "@/server/db/schema";
import { isLive, type TournamentRef } from "@/server/tournaments/repository";
import { generateToken, hashToken, type AccessRole } from "./tokens";

export type IssuedTokens = { readonly admin: string; readonly player: string };

/** Creates (or rotates) the admin and player tokens. The plain tokens are returned once and never stored. */
export async function issueAccessTokens(db: Database, tournamentId: string): Promise<IssuedTokens> {
  const issued: IssuedTokens = { admin: generateToken(), player: generateToken() };
  const roles: AccessRole[] = ["admin", "player"];
  for (const role of roles) {
    await db
      .insert(accessTokens)
      .values({ tournamentId, role, tokenHash: hashToken(issued[role]) })
      .onConflictDoUpdate({
        target: [accessTokens.tournamentId, accessTokens.role],
        set: { tokenHash: hashToken(issued[role]), createdAt: new Date() },
      });
  }
  return issued;
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
