CREATE TABLE "live_battle_sessions" (
  "room_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expires_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "live_battle_sessions_pkey" PRIMARY KEY ("room_id", "token_hash"),
  CONSTRAINT "live_battle_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "live_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "live_battle_sessions_expires_at_idx" ON "live_battle_sessions"("expires_at");
