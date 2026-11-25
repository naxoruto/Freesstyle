BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "live_battle_patron_entry_votes"
    GROUP BY "room_id", "round", "mc_id", "entry_index", "judge_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hay votos de entrada duplicados; revisar los datos antes de aplicar esta migracion';
  END IF;
END $$;

ALTER TABLE "live_battle_rubric_votes" ADD COLUMN "replica" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "live_battle_patron_entry_votes" ADD COLUMN "replica" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "live_battle_patron_extra_votes" ADD COLUMN "replica" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "live_battle_round_results" ADD COLUMN "replica" INTEGER NOT NULL DEFAULT 0;

DROP INDEX "live_battle_rubric_votes_room_id_round_judge_id_key";
DROP INDEX "live_battle_patron_extra_votes_room_id_round_judge_id_key";
DROP INDEX "live_battle_round_results_room_id_round_key";

CREATE UNIQUE INDEX "live_battle_rubric_scope_key" ON "live_battle_rubric_votes"("room_id", "replica", "round", "judge_id");
CREATE UNIQUE INDEX "live_battle_entry_scope_key" ON "live_battle_patron_entry_votes"("room_id", "replica", "round", "mc_id", "entry_index", "judge_id");
CREATE UNIQUE INDEX "live_battle_extra_scope_key" ON "live_battle_patron_extra_votes"("room_id", "replica", "round", "judge_id");
CREATE UNIQUE INDEX "live_battle_result_scope_key" ON "live_battle_round_results"("room_id", "replica", "round");

COMMIT;
