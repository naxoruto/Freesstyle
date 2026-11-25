ALTER TABLE "live_battles" ADD COLUMN "participant_order" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
