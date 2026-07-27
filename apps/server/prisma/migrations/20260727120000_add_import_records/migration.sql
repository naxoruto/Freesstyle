CREATE TABLE "import_records" (
    "key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "import_records_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "import_records_source_idx" ON "import_records"("source");
