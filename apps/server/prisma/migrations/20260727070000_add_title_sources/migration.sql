-- AlterTable
ALTER TABLE "titles" ADD COLUMN "source_id" TEXT;

-- CreateIndex
CREATE INDEX "titles_source_id_idx" ON "titles"("source_id");

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
