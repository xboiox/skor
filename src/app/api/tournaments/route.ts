import { ok } from "@/lib/api-response";
import { createTournamentSchema } from "@/lib/validation/tournament";
import { getCurrentSession } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { readJson } from "@/server/http/request-context";
import { withErrorHandling } from "@/server/http/route-handler";
import { assertSameOriginJson } from "@/server/http/same-origin";
import { createTournament } from "@/server/tournaments/create";
import { tournamentLinks } from "@/server/tournaments/links";

export const dynamic = "force-dynamic";

/** Creates a draft tournament. Signed-in users own it; guests get links that expire after GUEST_TTL_DAYS. */
export const POST = withErrorHandling(async (request: Request) => {
  const env = getEnv();
  assertSameOriginJson(request, env.APP_URL);
  const input = createTournamentSchema.parse(await readJson(request));
  const session = await getCurrentSession();

  const { tournament, tokens } = await createTournament(getDb(), input, {
    ownerId: session?.user.id ?? null,
    guestTtlDays: env.GUEST_TTL_DAYS,
  });

  return ok(
    {
      id: tournament.id,
      slug: tournament.slug,
      isGuest: !session,
      links: tournamentLinks(env.APP_URL, tournament.slug, tokens),
    },
    201,
  );
});
