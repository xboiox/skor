import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Column names are mapped to snake_case by `casing: "snake_case"` (see client.ts and drizzle.config.ts).

// ---------- Enums ----------

export const matchType = pgEnum("match_type", ["americano", "mexicano"]);
export const scoringType = pgEnum("scoring_type", ["rally", "tennis"]);
export const tennisMode = pgEnum("tennis_mode", ["first_to", "total_of"]);
export const deuceRule = pgEnum("deuce_rule", ["golden_point", "advantage"]);
export const tournamentStatus = pgEnum("tournament_status", ["draft", "active", "finished"]);
export const accessRole = pgEnum("access_role", ["admin", "player"]);
export const playerStatus = pgEnum("player_status", ["active", "withdrawn"]);
export const roundStatus = pgEnum("round_status", ["pending", "active", "completed"]);
export const matchStatus = pgEnum("match_status", [
  "scheduled",
  "in_progress",
  "submitted",
  "approved",
]);
export const substitutionType = pgEnum("substitution_type", ["temporary", "permanent"]);
export const substitutionSource = pgEnum("substitution_source", ["new_player", "bye_player"]);
export const scoreAction = pgEnum("score_action", [
  "point_a",
  "point_b",
  "undo",
  "set_final",
  "approve",
  "reject",
  "host_edit",
]);
export const actorRole = pgEnum("actor_role", ["host", "player"]);

// ---------- Shared columns ----------

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------- Auth ----------

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text(),
  email: text().notNull().unique(),
  emailVerified: timestamp({ withTimezone: true, mode: "date" }),
  passwordHash: text(), // null when the user only signs in with Google
  image: text(),
  createdAt: createdAt(),
});

// Shape required by the Auth.js Drizzle adapter (OAuth token field names are fixed by Auth.js).
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

// ---------- Tournament ----------

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    ownerId: uuid().references(() => users.id, { onDelete: "cascade" }), // null = guest
    name: text().notNull(),
    date: date({ mode: "string" }).notNull(),
    matchType: matchType().notNull(),
    courts: integer().notNull(),
    scoringType: scoringType().notNull(),
    rallyPoints: integer(),
    tennisMode: tennisMode(),
    tennisGames: integer(),
    deuceRule: deuceRule(),
    status: tournamentStatus().notNull().default("draft"),
    currentLeg: integer().notNull().default(1),
    rngSeed: integer().notNull(),
    expiresAt: timestamp({ withTimezone: true }), // set for guests only
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tournaments_owner_idx").on(t.ownerId),
    index("tournaments_expires_idx")
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} is not null`),
    check("tournaments_name_length", sql`char_length(${t.name}) between 1 and 100`),
    check("tournaments_courts_range", sql`${t.courts} between 1 and 20`),
    check("tournaments_current_leg", sql`${t.currentLeg} in (1, 2)`),
    check(
      "tournaments_scoring_config",
      sql`(
        ${t.scoringType} = 'rally'
        and ${t.rallyPoints} in (16, 21, 24, 32)
        and ${t.tennisMode} is null and ${t.tennisGames} is null and ${t.deuceRule} is null
      ) or (
        ${t.scoringType} = 'tennis'
        and ${t.rallyPoints} is null
        and ${t.tennisMode} is not null
        and ${t.tennisGames} between 1 and 12
        and ${t.deuceRule} is not null
      )`,
    ),
  ],
);

export const accessTokens = pgTable(
  "access_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    tournamentId: uuid()
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    role: accessRole().notNull(),
    tokenHash: text().notNull().unique(), // SHA-256 of the token; the token itself is never stored
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("access_tokens_tournament_role_unique").on(t.tournamentId, t.role)],
);

export const players = pgTable(
  "players",
  {
    id: uuid().primaryKey().defaultRandom(),
    tournamentId: uuid()
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text().notNull(),
    position: integer().notNull(),
    status: playerStatus().notNull().default("active"),
    joinedRound: integer(), // null = joined from the start
    withdrawnFromRound: integer(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("players_tournament_name_unique").on(t.tournamentId, sql`lower(${t.name})`),
    check("players_name_length", sql`char_length(${t.name}) between 1 and 50`),
  ],
);

// ---------- Rounds & matches ----------

export const rounds = pgTable(
  "rounds",
  {
    id: uuid().primaryKey().defaultRandom(),
    tournamentId: uuid()
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    number: integer().notNull(),
    leg: integer().notNull().default(1),
    status: roundStatus().notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("rounds_tournament_number_unique").on(t.tournamentId, t.number),
    check("rounds_number_positive", sql`${t.number} >= 1`),
    check("rounds_leg", sql`${t.leg} in (1, 2)`),
  ],
);

export const roundByes = pgTable(
  "round_byes",
  {
    roundId: uuid()
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    playerId: uuid()
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.playerId] })],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid().primaryKey().defaultRandom(),
    tournamentId: uuid()
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    roundId: uuid()
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    court: integer().notNull(),
    teamA1: uuid()
      .notNull()
      .references(() => players.id),
    teamA2: uuid()
      .notNull()
      .references(() => players.id),
    teamB1: uuid()
      .notNull()
      .references(() => players.id),
    teamB2: uuid()
      .notNull()
      .references(() => players.id),
    scoreA: integer().notNull().default(0), // rally: points, tennis: games
    scoreB: integer().notNull().default(0),
    gameA: integer().notNull().default(0), // tennis only: raw points in the current game
    gameB: integer().notNull().default(0),
    status: matchStatus().notNull().default("scheduled"),
    version: integer().notNull().default(0),
    approvedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("matches_tournament_round_idx").on(t.tournamentId, t.roundId),
    uniqueIndex("matches_round_court_unique").on(t.roundId, t.court),
    check("matches_court_positive", sql`${t.court} >= 1`),
    check(
      "matches_scores_non_negative",
      sql`${t.scoreA} >= 0 and ${t.scoreB} >= 0 and ${t.gameA} >= 0 and ${t.gameB} >= 0`,
    ),
    check(
      "matches_distinct_players",
      sql`${t.teamA1} <> ${t.teamA2} and ${t.teamA1} <> ${t.teamB1} and ${t.teamA1} <> ${t.teamB2}
        and ${t.teamA2} <> ${t.teamB1} and ${t.teamA2} <> ${t.teamB2} and ${t.teamB1} <> ${t.teamB2}`,
    ),
  ],
);

// ---------- History ----------

export const substitutions = pgTable(
  "substitutions",
  {
    id: uuid().primaryKey().defaultRandom(),
    tournamentId: uuid()
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    type: substitutionType().notNull(),
    fromRound: integer().notNull(),
    outPlayerId: uuid()
      .notNull()
      .references(() => players.id),
    inPlayerId: uuid()
      .notNull()
      .references(() => players.id),
    source: substitutionSource().notNull(),
    affectedMatchIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("substitutions_tournament_idx").on(t.tournamentId),
    check("substitutions_distinct_players", sql`${t.outPlayerId} <> ${t.inPlayerId}`),
    // Business rule (A8): a permanent substitute must be a new player.
    check(
      "substitutions_permanent_new_player",
      sql`${t.type} = 'temporary' or ${t.source} = 'new_player'`,
    ),
  ],
);

export type MatchSnapshot = {
  scoreA: number;
  scoreB: number;
  gameA: number;
  gameB: number;
  status: (typeof matchStatus.enumValues)[number];
};

export const scoreEvents = pgTable(
  "score_events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    matchId: uuid()
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    action: scoreAction().notNull(),
    actorRole: actorRole().notNull(),
    actorPlayerId: uuid().references(() => players.id),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    prevState: jsonb().$type<MatchSnapshot>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("score_events_match_idx").on(t.matchId, t.id.desc())],
);
