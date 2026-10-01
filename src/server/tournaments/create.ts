import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { AppError } from "@/lib/api-response";
import type { CreateTournamentInput } from "@/lib/validation/tournament";
import { issueAccessTokens, type IssuedTokens } from "@/server/access/access-repository";
import type { Database, Executor } from "@/server/db/client";
import { players, tournaments } from "@/server/db/schema";
import { scoringColumns } from "./scoring-columns";
import { generateSlug } from "./slug";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SLUG_ATTEMPTS = 10;
const MAX_SEED = 2 ** 31 - 1;

export type CreateOptions = {
  readonly ownerId: string | null;
  readonly guestTtlDays: number;
  readonly now?: Date;
};

export type CreatedTournament = {
  readonly tournament: { readonly id: string; readonly slug: string };
  readonly tokens: IssuedTokens;
};

async function uniqueSlug(db: Executor): Promise<string> {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const slug = generateSlug();
    const [taken] = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.slug, slug))
      .limit(1);
    if (!taken) return slug;
  }
  throw new AppError("INTERNAL_ERROR", "Could not create a tournament link. Please try again.");
}

/** Creates a draft tournament with its players and access links. Guests expire after `guestTtlDays`. */
export async function createTournament(
  db: Database,
  input: CreateTournamentInput,
  options: CreateOptions,
): Promise<CreatedTournament> {
  const now = options.now ?? new Date();
  const expiresAt = options.ownerId
    ? null
    : new Date(now.getTime() + options.guestTtlDays * DAY_MS);

  return db.transaction(async (tx) => {
    const [tournament] = await tx
      .insert(tournaments)
      .values({
        slug: await uniqueSlug(tx),
        ownerId: options.ownerId,
        name: input.name,
        date: input.date,
        matchType: input.matchType,
        courts: input.courts,
        ...scoringColumns(input.scoring),
        rngSeed: randomInt(MAX_SEED),
        expiresAt,
      })
      .returning({ id: tournaments.id, slug: tournaments.slug });

    await tx
      .insert(players)
      .values(
        input.players.map((name, position) => ({ tournamentId: tournament!.id, name, position })),
      );

    const tokens = await issueAccessTokens(tx, tournament!.id);
    return { tournament: tournament!, tokens };
  });
}
