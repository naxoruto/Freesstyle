-- CreateTable
CREATE TABLE "style_tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "style_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freestyler_styles" (
    "freestyler_id" TEXT NOT NULL,
    "style_tag_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "source_id" TEXT NOT NULL,
    CONSTRAINT "freestyler_styles_pkey" PRIMARY KEY ("freestyler_id", "style_tag_id")
);

CREATE UNIQUE INDEX "style_tags_slug_key" ON "style_tags"("slug");
CREATE INDEX "freestyler_styles_style_tag_id_idx" ON "freestyler_styles"("style_tag_id");
CREATE INDEX "freestyler_styles_source_id_idx" ON "freestyler_styles"("source_id");
CREATE UNIQUE INDEX "freestyler_styles_freestyler_id_rank_key" ON "freestyler_styles"("freestyler_id", "rank");

ALTER TABLE "freestyler_styles" ADD CONSTRAINT "freestyler_styles_freestyler_id_fkey" FOREIGN KEY ("freestyler_id") REFERENCES "freestylers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "freestyler_styles" ADD CONSTRAINT "freestyler_styles_style_tag_id_fkey" FOREIGN KEY ("style_tag_id") REFERENCES "style_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "freestyler_styles" ADD CONSTRAINT "freestyler_styles_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
