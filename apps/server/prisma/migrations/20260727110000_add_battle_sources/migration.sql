ALTER TABLE "battles" ADD COLUMN "external_id" TEXT;
ALTER TABLE "battles" ADD COLUMN "source_id" TEXT;

CREATE UNIQUE INDEX "battles_external_id_key" ON "battles"("external_id");
CREATE INDEX "battles_source_id_idx" ON "battles"("source_id");

ALTER TABLE "battles" ADD CONSTRAINT "battles_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
