import { and, eq } from "drizzle-orm";
import { AppError } from "@/lib/api-response";
import { players } from "@/server/db/schema";
import type { TournamentRef } from "@/server/tournaments/repository";
import { requirePlayerLink, type AccessContext } from "./guards";
import { accessCookieOptions, identityCookieName, type CookieOptions } from "./tokens";

export type IdentityCookie = {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
};

/** "I am …": the chosen player must be an active player of this tournament. */
export async function chooseIdentity(
  ctx: AccessContext,
  tournament: TournamentRef,
  playerId: string,
  isSecure: boolean,
): Promise<{ player: { id: string; name: string }; cookie: IdentityCookie }> {
  await requirePlayerLink(ctx, tournament);
  const [player] = await ctx.db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(
      and(
        eq(players.id, playerId),
        eq(players.tournamentId, tournament.id),
        eq(players.status, "active"),
      ),
    )
    .limit(1);
  if (!player) throw new AppError("VALIDATION_ERROR", "Choose a player from this tournament.");

  return {
    player,
    cookie: {
      name: identityCookieName(tournament.slug),
      value: player.id,
      options: accessCookieOptions({ expiresAt: tournament.expiresAt, isSecure }),
    },
  };
}
