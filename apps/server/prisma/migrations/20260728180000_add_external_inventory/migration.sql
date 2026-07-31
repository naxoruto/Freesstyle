CREATE TABLE "catalog_import_runs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "discovered_count" INTEGER NOT NULL DEFAULT 0,
    "fetched_count" INTEGER NOT NULL DEFAULT 0,
    "parsed_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "error" TEXT,
    CONSTRAINT "catalog_import_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_profiles" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "source_alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "country_code" VARCHAR(2),
    "real_name" TEXT,
    "birth_date" DATE,
    "birth_year" INTEGER,
    "parse_status" TEXT NOT NULL DEFAULT 'PARSED',
    "content_hash" TEXT,
    "payload" JSONB,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_run_id" TEXT,
    "linked_freestyler_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_profile_aliases" (
    "id" TEXT NOT NULL,
    "external_profile_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_profile_aliases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_participations" (
    "id" TEXT NOT NULL,
    "external_profile_id" TEXT NOT NULL,
    "competition_name" TEXT NOT NULL,
    "normalized_competition" TEXT NOT NULL,
    "season" TEXT,
    "event_name" TEXT,
    "stage" TEXT,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_participations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_wins" (
    "id" TEXT NOT NULL,
    "external_profile_id" TEXT NOT NULL,
    "competition_name" TEXT NOT NULL,
    "normalized_competition" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "season" TEXT,
    "event_name" TEXT,
    "year" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "counts_for_daily" BOOLEAN NOT NULL DEFAULT false,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_wins_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "catalog_import_runs_provider_kind_status_idx" ON "catalog_import_runs"("provider", "kind", "status");
CREATE UNIQUE INDEX "external_profiles_provider_external_id_key" ON "external_profiles"("provider", "external_id");
CREATE INDEX "external_profiles_provider_normalized_alias_idx" ON "external_profiles"("provider", "normalized_alias");
CREATE INDEX "external_profiles_linked_freestyler_id_idx" ON "external_profiles"("linked_freestyler_id");
CREATE INDEX "external_profiles_last_seen_run_id_idx" ON "external_profiles"("last_seen_run_id");
CREATE UNIQUE INDEX "external_profile_aliases_external_profile_id_normalized_alias_key" ON "external_profile_aliases"("external_profile_id", "normalized_alias");
CREATE INDEX "external_profile_aliases_normalized_alias_idx" ON "external_profile_aliases"("normalized_alias");
CREATE UNIQUE INDEX "external_participations_external_profile_id_normalized_competition_season_event_name_stage_key" ON "external_participations"("external_profile_id", "normalized_competition", "season", "event_name", "stage");
CREATE INDEX "external_participations_normalized_competition_idx" ON "external_participations"("normalized_competition");
CREATE UNIQUE INDEX "external_wins_external_profile_id_normalized_competition_label_key" ON "external_wins"("external_profile_id", "normalized_competition", "label");
CREATE INDEX "external_wins_normalized_competition_idx" ON "external_wins"("normalized_competition");
CREATE INDEX "external_wins_category_counts_for_daily_idx" ON "external_wins"("category", "counts_for_daily");

ALTER TABLE "external_profiles" ADD CONSTRAINT "external_profiles_last_seen_run_id_fkey" FOREIGN KEY ("last_seen_run_id") REFERENCES "catalog_import_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_profiles" ADD CONSTRAINT "external_profiles_linked_freestyler_id_fkey" FOREIGN KEY ("linked_freestyler_id") REFERENCES "freestylers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_profile_aliases" ADD CONSTRAINT "external_profile_aliases_external_profile_id_fkey" FOREIGN KEY ("external_profile_id") REFERENCES "external_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_participations" ADD CONSTRAINT "external_participations_external_profile_id_fkey" FOREIGN KEY ("external_profile_id") REFERENCES "external_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_wins" ADD CONSTRAINT "external_wins_external_profile_id_fkey" FOREIGN KEY ("external_profile_id") REFERENCES "external_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
