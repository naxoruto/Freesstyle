CREATE TABLE "live_battle_free_votes" (
  "room_id" TEXT NOT NULL, "replica" INTEGER NOT NULL, "round" INTEGER NOT NULL,
  "judge_id" TEXT NOT NULL, "judge_name" TEXT NOT NULL, "mc1_id" TEXT NOT NULL,
  "mc2_id" TEXT NOT NULL, "voted_for_id" TEXT NOT NULL,
  CONSTRAINT "live_battle_free_votes_pkey" PRIMARY KEY ("room_id", "replica", "round", "judge_id"),
  CONSTRAINT "live_battle_free_votes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "live_battle_room_votes" (
  "room_id" TEXT NOT NULL, "replica" INTEGER NOT NULL, "round" INTEGER NOT NULL,
  "voter_id" TEXT NOT NULL, "voter_name" TEXT NOT NULL, "mc1_id" TEXT NOT NULL,
  "mc2_id" TEXT NOT NULL, "voted_for_id" TEXT NOT NULL,
  CONSTRAINT "live_battle_room_votes_pkey" PRIMARY KEY ("room_id", "replica", "round", "voter_id"),
  CONSTRAINT "live_battle_room_votes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "live_battle_voting_rosters" (
  "room_id" TEXT NOT NULL, "replica" INTEGER NOT NULL, "round" INTEGER NOT NULL, "voter_ids" TEXT[] NOT NULL,
  CONSTRAINT "live_battle_voting_rosters_pkey" PRIMARY KEY ("room_id", "replica", "round"),
  CONSTRAINT "live_battle_voting_rosters_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
