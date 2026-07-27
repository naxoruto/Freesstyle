-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- AlterTable
ALTER TABLE "freestylers"
ADD COLUMN "birth_year" INTEGER,
ADD COLUMN "fms_participant" BOOLEAN,
ADD COLUMN "red_bull_international" BOOLEAN;

-- CreateTable
CREATE TABLE "data_review_issues" (
    "id" TEXT NOT NULL,
    "freestyler_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_review_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_review_issues_status_idx" ON "data_review_issues"("status");
CREATE UNIQUE INDEX "data_review_issues_freestyler_id_key_key" ON "data_review_issues"("freestyler_id", "key");

ALTER TABLE "data_review_issues" ADD CONSTRAINT "data_review_issues_freestyler_id_fkey" FOREIGN KEY ("freestyler_id") REFERENCES "freestylers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
