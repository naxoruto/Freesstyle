-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ChallengeGame" AS ENUM ('FREESTYLER', 'GRID', 'DRAFT');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "flag_emoji" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freestylers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "real_name" TEXT,
    "country_id" TEXT NOT NULL,
    "birth_date" DATE,
    "debut_year" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "instagram_url" TEXT,
    "youtube_url" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "freestylers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT,
    "international" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_year" INTEGER NOT NULL,
    "end_year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participations" (
    "id" TEXT NOT NULL,
    "freestyler_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "season_id" TEXT,
    "final_position" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "titles" (
    "id" TEXT NOT NULL,
    "freestyler_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "season_id" TEXT,
    "label" TEXT,
    "won_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battles" (
    "id" TEXT NOT NULL,
    "competitor_1_id" TEXT NOT NULL,
    "competitor_2_id" TEXT NOT NULL,
    "winner_id" TEXT,
    "competition_id" TEXT NOT NULL,
    "season_id" TEXT,
    "stage" TEXT,
    "battle_date" DATE,
    "had_replica" BOOLEAN NOT NULL DEFAULT false,
    "video_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freestyler_sources" (
    "freestyler_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    CONSTRAINT "freestyler_sources_pkey" PRIMARY KEY ("freestyler_id", "source_id")
);

-- CreateTable
CREATE TABLE "daily_challenges" (
    "id" TEXT NOT NULL,
    "game" "ChallengeGame" NOT NULL,
    "date_key" VARCHAR(10) NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_attempts" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "session_hash" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "won" BOOLEAN,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "game_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");
CREATE UNIQUE INDEX "freestylers_slug_key" ON "freestylers"("slug");
CREATE UNIQUE INDEX "freestylers_normalized_alias_key" ON "freestylers"("normalized_alias");
CREATE INDEX "freestylers_alias_idx" ON "freestylers"("alias");
CREATE INDEX "freestylers_country_id_idx" ON "freestylers"("country_id");
CREATE UNIQUE INDEX "competitions_slug_key" ON "competitions"("slug");
CREATE INDEX "seasons_start_year_idx" ON "seasons"("start_year");
CREATE UNIQUE INDEX "seasons_competition_id_name_key" ON "seasons"("competition_id", "name");
CREATE INDEX "participations_competition_id_idx" ON "participations"("competition_id");
CREATE INDEX "participations_season_id_idx" ON "participations"("season_id");
CREATE UNIQUE INDEX "participations_freestyler_id_competition_id_season_id_key" ON "participations"("freestyler_id", "competition_id", "season_id");
CREATE INDEX "titles_competition_id_idx" ON "titles"("competition_id");
CREATE UNIQUE INDEX "titles_freestyler_id_competition_id_season_id_label_key" ON "titles"("freestyler_id", "competition_id", "season_id", "label");
CREATE INDEX "battles_competitor_1_id_idx" ON "battles"("competitor_1_id");
CREATE INDEX "battles_competitor_2_id_idx" ON "battles"("competitor_2_id");
CREATE INDEX "battles_winner_id_idx" ON "battles"("winner_id");
CREATE INDEX "battles_competition_id_season_id_idx" ON "battles"("competition_id", "season_id");
CREATE UNIQUE INDEX "data_sources_url_key" ON "data_sources"("url");
CREATE INDEX "daily_challenges_status_date_key_idx" ON "daily_challenges"("status", "date_key");
CREATE UNIQUE INDEX "daily_challenges_game_date_key_key" ON "daily_challenges"("game", "date_key");
CREATE INDEX "game_attempts_challenge_id_completed_idx" ON "game_attempts"("challenge_id", "completed");
CREATE UNIQUE INDEX "game_attempts_challenge_id_session_hash_key" ON "game_attempts"("challenge_id", "session_hash");

ALTER TABLE "freestylers" ADD CONSTRAINT "freestylers_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participations" ADD CONSTRAINT "participations_freestyler_id_fkey" FOREIGN KEY ("freestyler_id") REFERENCES "freestylers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participations" ADD CONSTRAINT "participations_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participations" ADD CONSTRAINT "participations_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_freestyler_id_fkey" FOREIGN KEY ("freestyler_id") REFERENCES "freestylers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battles" ADD CONSTRAINT "battles_competitor_1_id_fkey" FOREIGN KEY ("competitor_1_id") REFERENCES "freestylers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "battles" ADD CONSTRAINT "battles_competitor_2_id_fkey" FOREIGN KEY ("competitor_2_id") REFERENCES "freestylers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "battles" ADD CONSTRAINT "battles_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "freestylers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battles" ADD CONSTRAINT "battles_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "battles" ADD CONSTRAINT "battles_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "freestyler_sources" ADD CONSTRAINT "freestyler_sources_freestyler_id_fkey" FOREIGN KEY ("freestyler_id") REFERENCES "freestylers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "freestyler_sources" ADD CONSTRAINT "freestyler_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "daily_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
