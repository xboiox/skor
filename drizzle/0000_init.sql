CREATE TYPE "public"."access_role" AS ENUM('admin', 'player');--> statement-breakpoint
CREATE TYPE "public"."actor_role" AS ENUM('host', 'player');--> statement-breakpoint
CREATE TYPE "public"."deuce_rule" AS ENUM('golden_point', 'advantage');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'in_progress', 'submitted', 'approved');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('americano', 'mexicano');--> statement-breakpoint
CREATE TYPE "public"."player_status" AS ENUM('active', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('pending', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."score_action" AS ENUM('point_a', 'point_b', 'undo', 'set_final', 'approve', 'reject', 'host_edit');--> statement-breakpoint
CREATE TYPE "public"."scoring_type" AS ENUM('rally', 'tennis');--> statement-breakpoint
CREATE TYPE "public"."substitution_source" AS ENUM('new_player', 'bye_player');--> statement-breakpoint
CREATE TYPE "public"."substitution_type" AS ENUM('temporary', 'permanent');--> statement-breakpoint
CREATE TYPE "public"."tennis_mode" AS ENUM('first_to', 'total_of');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'active', 'finished');--> statement-breakpoint
CREATE TABLE "access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"role" "access_role" NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"court" integer NOT NULL,
	"team_a_1" uuid NOT NULL,
	"team_a_2" uuid NOT NULL,
	"team_b_1" uuid NOT NULL,
	"team_b_2" uuid NOT NULL,
	"score_a" integer DEFAULT 0 NOT NULL,
	"score_b" integer DEFAULT 0 NOT NULL,
	"game_a" integer DEFAULT 0 NOT NULL,
	"game_b" integer DEFAULT 0 NOT NULL,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_court_positive" CHECK ("matches"."court" >= 1),
	CONSTRAINT "matches_scores_non_negative" CHECK ("matches"."score_a" >= 0 and "matches"."score_b" >= 0 and "matches"."game_a" >= 0 and "matches"."game_b" >= 0),
	CONSTRAINT "matches_distinct_players" CHECK ("matches"."team_a_1" <> "matches"."team_a_2" and "matches"."team_a_1" <> "matches"."team_b_1" and "matches"."team_a_1" <> "matches"."team_b_2"
        and "matches"."team_a_2" <> "matches"."team_b_1" and "matches"."team_a_2" <> "matches"."team_b_2" and "matches"."team_b_1" <> "matches"."team_b_2")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"status" "player_status" DEFAULT 'active' NOT NULL,
	"joined_round" integer,
	"withdrawn_from_round" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_name_length" CHECK (char_length("players"."name") between 1 and 50)
);
--> statement-breakpoint
CREATE TABLE "round_byes" (
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	CONSTRAINT "round_byes_round_id_player_id_pk" PRIMARY KEY("round_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"leg" integer DEFAULT 1 NOT NULL,
	"status" "round_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_number_positive" CHECK ("rounds"."number" >= 1),
	CONSTRAINT "rounds_leg" CHECK ("rounds"."leg" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "score_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"action" "score_action" NOT NULL,
	"actor_role" "actor_role" NOT NULL,
	"actor_player_id" uuid,
	"actor_user_id" uuid,
	"prev_state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "substitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"type" "substitution_type" NOT NULL,
	"from_round" integer NOT NULL,
	"out_player_id" uuid NOT NULL,
	"in_player_id" uuid NOT NULL,
	"source" "substitution_source" NOT NULL,
	"affected_match_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "substitutions_distinct_players" CHECK ("substitutions"."out_player_id" <> "substitutions"."in_player_id"),
	CONSTRAINT "substitutions_permanent_new_player" CHECK ("substitutions"."type" = 'temporary' or "substitutions"."source" = 'new_player')
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"match_type" "match_type" NOT NULL,
	"courts" integer NOT NULL,
	"scoring_type" "scoring_type" NOT NULL,
	"rally_points" integer,
	"tennis_mode" "tennis_mode",
	"tennis_games" integer,
	"deuce_rule" "deuce_rule",
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"current_leg" integer DEFAULT 1 NOT NULL,
	"rng_seed" integer NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tournaments_name_length" CHECK (char_length("tournaments"."name") between 1 and 100),
	CONSTRAINT "tournaments_courts_range" CHECK ("tournaments"."courts" between 1 and 20),
	CONSTRAINT "tournaments_current_leg" CHECK ("tournaments"."current_leg" in (1, 2)),
	CONSTRAINT "tournaments_scoring_config" CHECK ((
        "tournaments"."scoring_type" = 'rally'
        and "tournaments"."rally_points" in (16, 21, 24, 32)
        and "tournaments"."tennis_mode" is null and "tournaments"."tennis_games" is null and "tournaments"."deuce_rule" is null
      ) or (
        "tournaments"."scoring_type" = 'tennis'
        and "tournaments"."rally_points" is null
        and "tournaments"."tennis_mode" is not null
        and "tournaments"."tennis_games" between 1 and 12
        and "tournaments"."deuce_rule" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"password_hash" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_1_players_id_fk" FOREIGN KEY ("team_a_1") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_2_players_id_fk" FOREIGN KEY ("team_a_2") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_1_players_id_fk" FOREIGN KEY ("team_b_1") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_2_players_id_fk" FOREIGN KEY ("team_b_2") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_byes" ADD CONSTRAINT "round_byes_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_byes" ADD CONSTRAINT "round_byes_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_actor_player_id_players_id_fk" FOREIGN KEY ("actor_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_out_player_id_players_id_fk" FOREIGN KEY ("out_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_in_player_id_players_id_fk" FOREIGN KEY ("in_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_tokens_tournament_role_unique" ON "access_tokens" USING btree ("tournament_id","role");--> statement-breakpoint
CREATE INDEX "matches_tournament_round_idx" ON "matches" USING btree ("tournament_id","round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_round_court_unique" ON "matches" USING btree ("round_id","court");--> statement-breakpoint
CREATE UNIQUE INDEX "players_tournament_name_unique" ON "players" USING btree ("tournament_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_tournament_number_unique" ON "rounds" USING btree ("tournament_id","number");--> statement-breakpoint
CREATE INDEX "score_events_match_idx" ON "score_events" USING btree ("match_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "substitutions_tournament_idx" ON "substitutions" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "tournaments_owner_idx" ON "tournaments" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tournaments_expires_idx" ON "tournaments" USING btree ("expires_at") WHERE "tournaments"."expires_at" is not null;