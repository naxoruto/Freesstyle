import type { Battle, BattleModeConfig, Participant, ReplicaConfig, Word, JudgeRubricVote, PatronEntryVote, PatronExtraVote } from "@freestyle/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

// --- Serialization helpers ---

function serializeBattle(battle: Battle): Prisma.LiveBattleCreateInput {
  return {
    id: battle.id,
    modeConfig: battle.mode as unknown as Prisma.JsonObject,
    status: battle.status,
    currentRound: battle.currentRound,
    roundPhase: battle.roundPhase,
    currentTurn: battle.currentTurn,
    currentWord: battle.currentWord ? (battle.currentWord as unknown as Prisma.JsonObject) : Prisma.JsonNull,
    timeRemaining: battle.timeRemaining,
    entriesRemaining: battle.entriesRemaining as unknown as Prisma.JsonObject,
    totalScores: battle.totalScores as unknown as Prisma.JsonObject,
    turnSequenceIndex: battle.turnSequenceIndex,
    replicaCount: battle.replicaCount,
    replicaConfig: battle.replicaConfig ? (battle.replicaConfig as unknown as Prisma.JsonObject) : Prisma.JsonNull,
    hostId: battle.hostId ?? null,
    adminIds: [],
    phaseToken: null,
  };
}

function deserializeBattle(
  row: {
    id: string;
    modeConfig: unknown;
    status: string;
    currentRound: number;
    roundPhase: string;
    currentTurn: string;
    currentWord: unknown;
    timeRemaining: number;
    entriesRemaining: unknown;
    totalScores: unknown;
    turnSequenceIndex: number;
    replicaCount: number;
    replicaConfig: unknown;
    hostId: string | null;
    adminIds: string[];
    createdAt: Date;
    updatedAt: Date;
    participants?: { userId: string; name: string; alias: string; isActive: boolean; currentScore: number; roundsWon: number }[];
    judges?: { userId: string; alias: string }[];
    spectators?: { userId: string; alias: string }[];
    roundResults?: { round: number; winnerId: string | null; scores: unknown; judgeVotes: unknown }[];
  },
): Battle {
  return {
    id: row.id,
    mode: row.modeConfig as BattleModeConfig,
    status: row.status as Battle["status"],
    currentRound: row.currentRound,
    roundPhase: row.roundPhase as Battle["roundPhase"],
    currentTurn: row.currentTurn,
    currentWord: (row.currentWord as Word) ?? undefined,
    timeRemaining: row.timeRemaining,
    entriesRemaining: (row.entriesRemaining as Record<string, number>) ?? {},
    totalScores: (row.totalScores as Record<string, number>) ?? {},
    turnSequenceIndex: row.turnSequenceIndex,
    replicaCount: row.replicaCount,
    replicaConfig: (row.replicaConfig as ReplicaConfig) ?? undefined,
    hostId: row.hostId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    participants: (row.participants ?? []).map((p) => ({
      userId: p.userId,
      name: p.name,
      alias: p.alias,
      isActive: p.isActive,
      currentScore: p.currentScore,
      roundsWon: p.roundsWon,
    })),
    judges: (row.judges ?? []).map((j) => ({ id: j.userId, alias: j.alias })),
    spectators: (row.spectators ?? []).map((s) => ({ id: s.userId, alias: s.alias })),
    roundResults: (row.roundResults ?? []).map((r) => ({
      round: r.round,
      winnerId: r.winnerId ?? undefined,
      scores: r.scores as Record<string, number>,
      judgeVotes: (r.judgeVotes as { judgeId: string; judgeName: string; votedForId?: string }[]) ?? [],
    })),
  };
}

// --- Repository ---

export class BattlePersistence {
  async create(battle: Battle): Promise<Battle> {
    await prisma.liveBattle.create({
      data: serializeBattle(battle),
    });
    return battle;
  }

  async findById(id: string): Promise<Battle | null> {
    const row = await prisma.liveBattle.findUnique({
      where: { id: id.toLowerCase() },
      include: {
        participants: true,
        judges: true,
        spectators: true,
        roundResults: { orderBy: { round: "asc" } },
      },
    });
    if (!row) return null;
    return deserializeBattle({
      ...row,
      participants: row.participants.map((p) => ({
        userId: p.userId,
        name: p.name,
        alias: p.alias,
        isActive: p.isActive,
        currentScore: p.currentScore,
        roundsWon: p.roundsWon,
      })),
      judges: row.judges.map((j) => ({ userId: j.userId, alias: j.alias })),
      spectators: row.spectators.map((s) => ({ userId: s.userId, alias: s.alias })),
      roundResults: row.roundResults.map((r) => ({
        round: r.round,
        winnerId: r.winnerId,
        scores: r.scores,
        judgeVotes: r.judgeVotes,
      })),
    });
  }

  async update(battle: Battle): Promise<Battle> {
    await prisma.liveBattle.update({
      where: { id: battle.id },
      data: {
        modeConfig: battle.mode as unknown as Prisma.JsonObject,
        status: battle.status,
        currentRound: battle.currentRound,
        roundPhase: battle.roundPhase,
        currentTurn: battle.currentTurn,
        currentWord: battle.currentWord ? (battle.currentWord as unknown as Prisma.JsonObject) : Prisma.JsonNull,
        timeRemaining: battle.timeRemaining,
        entriesRemaining: battle.entriesRemaining as unknown as Prisma.JsonObject,
        totalScores: battle.totalScores as unknown as Prisma.JsonObject,
        turnSequenceIndex: battle.turnSequenceIndex,
        replicaCount: battle.replicaCount,
        replicaConfig: battle.replicaConfig ? (battle.replicaConfig as unknown as Prisma.JsonObject) : Prisma.JsonNull,
        hostId: battle.hostId ?? null,
      },
    });
    return battle;
  }

  async delete(id: string): Promise<void> {
    await prisma.liveBattle.delete({ where: { id: id.toLowerCase() } }).catch(() => {});
  }

  // --- Participants ---

  async addParticipant(roomId: string, participant: Participant): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    await prisma.liveBattleParticipant.upsert({
      where: { roomId_userId: { roomId: normalizedId, userId: participant.userId } },
      create: {
        roomId: normalizedId,
        userId: participant.userId,
        name: participant.name,
        alias: participant.alias,
        isActive: participant.isActive,
        currentScore: participant.currentScore,
        roundsWon: participant.roundsWon,
      },
      update: {
        name: participant.name,
        alias: participant.alias,
        isActive: participant.isActive,
        currentScore: participant.currentScore,
        roundsWon: participant.roundsWon,
      },
    });
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    await prisma.liveBattleParticipant.deleteMany({
      where: { roomId: roomId.toLowerCase(), userId },
    });
  }

  // --- Judges ---

  async addJudge(roomId: string, judge: { id: string; alias: string }): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    await prisma.liveBattleJudge.upsert({
      where: { roomId_userId: { roomId: normalizedId, userId: judge.id } },
      create: { roomId: normalizedId, userId: judge.id, alias: judge.alias },
      update: { alias: judge.alias },
    });
  }

  async removeJudge(roomId: string, userId: string): Promise<void> {
    await prisma.liveBattleJudge.deleteMany({
      where: { roomId: roomId.toLowerCase(), userId },
    });
  }

  // --- Spectators ---

  async addSpectator(roomId: string, spectator: { id: string; alias: string }): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    await prisma.liveBattleSpectator.upsert({
      where: { roomId_userId: { roomId: normalizedId, userId: spectator.id } },
      create: { roomId: normalizedId, userId: spectator.id, alias: spectator.alias },
      update: { alias: spectator.alias },
    });
  }

  async removeSpectator(roomId: string, userId: string): Promise<void> {
    await prisma.liveBattleSpectator.deleteMany({
      where: { roomId: roomId.toLowerCase(), userId },
    });
  }

  // --- Rubric votes ---

  async saveRubricVote(roomId: string, vote: JudgeRubricVote): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    await prisma.liveBattleRubricVote.upsert({
      where: { roomId_round_judgeId: { roomId: normalizedId, round: vote.round, judgeId: vote.judgeId } },
      create: {
        roomId: normalizedId,
        judgeId: vote.judgeId,
        judgeName: vote.judgeName,
        round: vote.round,
        mc1Id: vote.mc1Id,
        mc2Id: vote.mc2Id,
        mc1Scores: vote.mc1Scores as unknown as Prisma.JsonObject,
        mc2Scores: vote.mc2Scores as unknown as Prisma.JsonObject,
      },
      update: {
        judgeName: vote.judgeName,
        mc1Id: vote.mc1Id,
        mc2Id: vote.mc2Id,
        mc1Scores: vote.mc1Scores as unknown as Prisma.JsonObject,
        mc2Scores: vote.mc2Scores as unknown as Prisma.JsonObject,
      },
    });
  }

  async getRubricVotes(roomId: string, round: number): Promise<JudgeRubricVote[]> {
    const rows = await prisma.liveBattleRubricVote.findMany({
      where: { roomId: roomId.toLowerCase(), round },
    });
    return rows.map((r) => ({
      judgeId: r.judgeId,
      judgeName: r.judgeName,
      round: r.round,
      mc1Id: r.mc1Id,
      mc2Id: r.mc2Id,
      mc1Scores: r.mc1Scores as unknown as JudgeRubricVote["mc1Scores"],
      mc2Scores: r.mc2Scores as unknown as JudgeRubricVote["mc2Scores"],
    }));
  }

  // --- Patron entry votes ---

  async savePatronEntryVote(roomId: string, voteKey: string, vote: PatronEntryVote): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    // voteKey is like "battleId:round:mcId:entryIndex"
    await prisma.liveBattlePatronEntryVote.create({
      data: {
        roomId: normalizedId,
        judgeId: vote.judgeId,
        judgeName: vote.judgeName,
        round: vote.round,
        entryIndex: vote.entryIndex,
        mcId: vote.mcId,
        points: vote.points,
      },
    });
  }

  async getPatronEntryVotes(roomId: string, round: number): Promise<PatronEntryVote[]> {
    const rows = await prisma.liveBattlePatronEntryVote.findMany({
      where: { roomId: roomId.toLowerCase(), round },
    });
    return rows.map((r) => ({
      judgeId: r.judgeId,
      judgeName: r.judgeName,
      round: r.round,
      entryIndex: r.entryIndex,
      mcId: r.mcId,
      points: r.points,
    }));
  }

  async deletePatronEntryVotes(roomId: string, round: number, mcId: string, entryIndex: number): Promise<void> {
    await prisma.liveBattlePatronEntryVote.deleteMany({
      where: { roomId: roomId.toLowerCase(), round, mcId, entryIndex },
    });
  }

  // --- Patron extra votes ---

  async savePatronExtraVote(roomId: string, vote: PatronExtraVote): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    await prisma.liveBattlePatronExtraVote.upsert({
      where: { roomId_round_judgeId: { roomId: normalizedId, round: vote.round, judgeId: vote.judgeId } },
      create: {
        roomId: normalizedId,
        judgeId: vote.judgeId,
        judgeName: vote.judgeName,
        round: vote.round,
        mc1Id: vote.mc1Id,
        mc2Id: vote.mc2Id,
        mc1Extra: vote.mc1Extra,
        mc2Extra: vote.mc2Extra,
      },
      update: {
        judgeName: vote.judgeName,
        mc1Id: vote.mc1Id,
        mc2Id: vote.mc2Id,
        mc1Extra: vote.mc1Extra,
        mc2Extra: vote.mc2Extra,
      },
    });
  }

  async getPatronExtraVotes(roomId: string, round: number): Promise<PatronExtraVote[]> {
    const rows = await prisma.liveBattlePatronExtraVote.findMany({
      where: { roomId: roomId.toLowerCase(), round },
    });
    return rows.map((r) => ({
      judgeId: r.judgeId,
      judgeName: r.judgeName,
      round: r.round,
      mc1Id: r.mc1Id,
      mc2Id: r.mc2Id,
      mc1Extra: r.mc1Extra,
      mc2Extra: r.mc2Extra,
    }));
  }

  // --- Round results ---

  async saveRoundResult(
    roomId: string,
    round: number,
    scores: Record<string, number>,
    winnerId: string | undefined,
    judgeVotes: { judgeId: string; judgeName: string; votedForId?: string }[],
  ): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    await prisma.liveBattleRoundResult.upsert({
      where: { roomId_round: { roomId: normalizedId, round } },
      create: {
        roomId: normalizedId,
        round,
        winnerId: winnerId ?? null,
        scores: scores as unknown as Prisma.JsonObject,
        judgeVotes: judgeVotes as unknown as Prisma.JsonObject,
      },
      update: {
        winnerId: winnerId ?? null,
        scores: scores as unknown as Prisma.JsonObject,
        judgeVotes: judgeVotes as unknown as Prisma.JsonObject,
      },
    });
  }

  // --- Load active battles (for server restart) ---

  async loadActiveBattles(): Promise<Battle[]> {
    const rows = await prisma.liveBattle.findMany({
      where: {
        status: { in: ["lobby", "in_progress", "replica"] },
      },
      include: {
        participants: true,
        judges: true,
        spectators: true,
        roundResults: { orderBy: { round: "asc" } },
      },
    });

    return rows.map((row) =>
      deserializeBattle({
        ...row,
        participants: row.participants.map((p) => ({
          userId: p.userId,
          name: p.name,
          alias: p.alias,
          isActive: p.isActive,
          currentScore: p.currentScore,
          roundsWon: p.roundsWon,
        })),
        judges: row.judges.map((j) => ({ userId: j.userId, alias: j.alias })),
        spectators: row.spectators.map((s) => ({ userId: s.userId, alias: s.alias })),
        roundResults: row.roundResults.map((r) => ({
          round: r.round,
          winnerId: r.winnerId,
          scores: r.scores,
          judgeVotes: r.judgeVotes,
        })),
      }),
    );
  }
}
