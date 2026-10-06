import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { players } from "@/server/db/schema";
import type { AccessContext } from "./guards";
import { identityCookieName } from "./tokens";

/** The player chosen in "I am …" on this device, if it is still an active player of the tournament. */
export async function currentIdentity(
  ctx: AccessContext,
  tournament: { id: string; slug: string },
): Promise<string | null> {
  const parsed = z.uuid().safeParse(ctx.cookies.get(identityCookieName(tournament.slug))?.value);
  if (!parsed.success) return null;
  const [player] = await ctx.db
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        eq(players.id, parsed.data),
        eq(players.tournamentId, tournament.id),
        eq(players.status, "active"),
      ),
    )
    .limit(1);
  return player?.id ?? null;
}
