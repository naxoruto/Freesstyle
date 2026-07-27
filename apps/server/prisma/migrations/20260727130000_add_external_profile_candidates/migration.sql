CREATE TABLE "external_profile_candidates" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "profile_url" TEXT NOT NULL,
    "country_code" TEXT,
    "suggested_alias" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_profile_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_profile_candidates_source_normalized_alias_key" ON "external_profile_candidates"("source", "normalized_alias");
CREATE INDEX "external_profile_candidates_status_idx" ON "external_profile_candidates"("status");
