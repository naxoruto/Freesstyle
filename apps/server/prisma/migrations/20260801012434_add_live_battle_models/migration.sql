-- DropIndex
DROP INDEX "battles_source_id_idx";

-- CreateTable
CREATE TABLE "live_battles" (
    "id" TEXT NOT NULL,
    "mode_config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'lobby',
    "current_round" INTEGER NOT NULL DEFAULT 0,
    "round_phase" TEXT NOT NULL DEFAULT 'countdown',
    "current_turn" TEXT NOT NULL DEFAULT '',
    "current_word" JSONB,
    "time_remaining" INTEGER NOT NULL DEFAULT 0,
    "entries_remaining" JSONB NOT NULL DEFAULT '{}',
    "total_scores" JSONB NOT NULL DEFAULT '{}',
    "turn_sequence_index" INTEGER NOT NULL DEFAULT 0,
    "replica_count" INTEGER NOT NULL DEFAULT 0,
    "replica_config" JSONB,
    "host_id" TEXT,
    "admin_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phase_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_battle_participants" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "current_score" INTEGER NOT NULL DEFAULT 0,
    "rounds_won" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_battle_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_battle_judges" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_battle_judges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_battle_spectators" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_battle_spectators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_battle_rubric_votes" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "judge_id" TEXT NOT NULL,
    "judge_name" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "mc1_id" TEXT NOT NULL,
    "mc2_id" TEXT NOT NULL,
    "mc1_scores" JSONB NOT NULL,
    "mc2_scores" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_battle_rubric_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_battle_patron_entry_votes" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "judge_id" TEXT NOT NULL,
    "judge_name" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "entry_index" INTEGER NOT NULL,
    "mc_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_battle_patron_entry_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_battle_patron_extra_votes" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "judge_id" TEXT NOT NULL,
    "judge_name" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "mc1_id" TEXT NOT NULL,
    "mc2_id" TEXT NOT NULL,
    "mc1_extra" INTEGER NOT NULL,
    "mc2_extra" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_battle_patron_extra_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_battle_round_results" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "winner_id" TEXT,
    "scores" JSONB NOT NULL,
    "judge_votes" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_battle_round_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "live_battle_participants_room_id_idx" ON "live_battle_participants"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_battle_participants_room_id_user_id_key" ON "live_battle_participants"("room_id", "user_id");

-- CreateIndex
CREATE INDEX "live_battle_judges_room_id_idx" ON "live_battle_judges"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_battle_judges_room_id_user_id_key" ON "live_battle_judges"("room_id", "user_id");

-- CreateIndex
CREATE INDEX "live_battle_spectators_room_id_idx" ON "live_battle_spectators"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_battle_spectators_room_id_user_id_key" ON "live_battle_spectators"("room_id", "user_id");

-- CreateIndex
CREATE INDEX "live_battle_rubric_votes_room_id_round_idx" ON "live_battle_rubric_votes"("room_id", "round");

-- CreateIndex
CREATE UNIQUE INDEX "live_battle_rubric_votes_room_id_round_judge_id_key" ON "live_battle_rubric_votes"("room_id", "round", "judge_id");

-- CreateIndex
CREATE INDEX "live_battle_patron_entry_votes_room_id_round_mc_id_entry_in_idx" ON "live_battle_patron_entry_votes"("room_id", "round", "mc_id", "entry_index");

-- CreateIndex
CREATE INDEX "live_battle_patron_extra_votes_room_id_round_idx" ON "live_battle_patron_extra_votes"("room_id", "round");

-- CreateIndex
CREATE UNIQUE INDEX "live_battle_patron_extra_votes_room_id_round_judge_id_key" ON "live_battle_patron_extra_votes"("room_id", "round", "judge_id");

-- CreateIndex
CREATE INDEX "live_battle_round_results_room_id_idx" ON "live_battle_round_results"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_battle_round_results_room_id_round_key" ON "live_battle_round_results"("room_id", "round");

-- AddForeignKey
ALTER TABLE "live_battle_participants" ADD CONSTRAINT "live_battle_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_battle_judges" ADD CONSTRAINT "live_battle_judges_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_battle_spectators" ADD CONSTRAINT "live_battle_spectators_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_battle_rubric_votes" ADD CONSTRAINT "live_battle_rubric_votes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_battle_patron_entry_votes" ADD CONSTRAINT "live_battle_patron_entry_votes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_battle_patron_extra_votes" ADD CONSTRAINT "live_battle_patron_extra_votes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_battle_round_results" ADD CONSTRAINT "live_battle_round_results_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "external_participations_external_profile_id_normalized_competit" RENAME TO "external_participations_external_profile_id_normalized_comp_key";

-- RenameIndex
ALTER INDEX "external_profile_aliases_external_profile_id_normalized_alias_k" RENAME TO "external_profile_aliases_external_profile_id_normalized_ali_key";

-- RenameIndex
ALTER INDEX "external_wins_external_profile_id_normalized_competition_label_" RENAME TO "external_wins_external_profile_id_normalized_competition_la_key";
