-- CreateTable
CREATE TABLE "freestyler_aliases" (
    "id" TEXT NOT NULL,
    "freestyler_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized_alias" TEXT NOT NULL,
    "source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "freestyler_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "freestyler_aliases_freestyler_id_normalized_alias_key" ON "freestyler_aliases"("freestyler_id", "normalized_alias");
CREATE INDEX "freestyler_aliases_normalized_alias_idx" ON "freestyler_aliases"("normalized_alias");
CREATE INDEX "freestyler_aliases_source_id_idx" ON "freestyler_aliases"("source_id");

ALTER TABLE "freestyler_aliases" ADD CONSTRAINT "freestyler_aliases_freestyler_id_fkey" FOREIGN KEY ("freestyler_id") REFERENCES "freestylers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "freestyler_aliases" ADD CONSTRAINT "freestyler_aliases_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
