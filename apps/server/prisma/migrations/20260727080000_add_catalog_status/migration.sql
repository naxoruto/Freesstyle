-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('CANDIDATE', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "freestylers" ADD COLUMN "catalog_status" "CatalogStatus" NOT NULL DEFAULT 'CANDIDATE';

-- Preserve the curated catalog that predates candidate discovery.
UPDATE "freestylers" SET "catalog_status" = 'PUBLISHED';

-- CreateIndex
CREATE INDEX "freestylers_catalog_status_idx" ON "freestylers"("catalog_status");
