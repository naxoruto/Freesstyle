import type { Battle, BattleModeConfig, Participant, ReplicaConfig, Word, JudgeRubricVote, PatronEntryVote, PatronExtraVote, FreeVote, RoomVote } from "@freestyle/shared";
import { LOCAL_PARTICIPANT_PREFIX, isLocalParticipantId } from "@freestyle/shared";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
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
    pendingEntry: battle.pendingEntry ? (battle.pendingEntry as unknown as Prisma.JsonObject) : Prisma.DbNull,
    participantOrder: battle.participants.map(participant => participant.userId),
    timeRemaining: battle.timeRemaining,
    entriesRemaining: battle.entriesRemaining as unknown as Prisma.JsonObject,
    totalScores: battle.totalScores as unknown as Prisma.JsonObject,
    turnSequenceIndex: battle.turnSequenceIndex,
    replicaCount: battle.replicaCount,
    replicaConfig: battle.replicaConfig ? (battle.replicaConfig as unknown as Prisma.JsonObject) : Prisma.JsonNull,
    hostId: battle.hostId ?? null,
    adminIds: battle.members.filter(member => member.roles.includes("admin")).map(member => member.userId),
    phaseToken: battle.phaseToken ?? null,
    phaseDeadline: battle.phaseDeadline ? new Date(battle.phaseDeadline) : null,
  };
}

function serializeBattleUpdate(snapshot: Battle): Prisma.LiveBattleUpdateInput {
  return {
    phaseToken: snapshot.phaseToken ?? null,
    phaseDeadline: snapshot.phaseDeadline ? new Date(snapshot.phaseDeadline) : null,
    modeConfig: snapshot.mode as unknown as Prisma.JsonObject,
    status: snapshot.status,
    currentRound: snapshot.currentRound,
    roundPhase: snapshot.roundPhase,
    currentTurn: snapshot.currentTurn,
    currentWord: snapshot.currentWord ? (snapshot.currentWord as unknown as Prisma.JsonObject) : Prisma.JsonNull,
    pendingEntry: snapshot.pendingEntry ? (snapshot.pendingEntry as unknown as Prisma.JsonObject) : Prisma.DbNull,
    participantOrder: snapshot.participants.map(participant => participant.userId),
    timeRemaining: snapshot.timeRemaining,
    entriesRemaining: snapshot.entriesRemaining as unknown as Prisma.JsonObject,
    totalScores: snapshot.totalScores as unknown as Prisma.JsonObject,
    turnSequenceIndex: snapshot.turnSequenceIndex,
    replicaCount: snapshot.replicaCount,
    replicaConfig: snapshot.replicaConfig ? (snapshot.replicaConfig as unknown as Prisma.JsonObject) : Prisma.JsonNull,
    hostId: snapshot.hostId ?? null,
    adminIds: snapshot.members.filter(member => member.roles.includes("admin")).map(member => member.userId),
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
    pendingEntry: unknown;
    participantOrder: string[];
    timeRemaining: number;
    phaseToken: string | null;
    phaseDeadline: Date | null;
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
    roundResults?: { round: number; replica: number; winnerId: string | null; scores: unknown; judgeVotes: unknown }[];
  },
): Battle {
  const memberMap = new Map<string, Battle["members"][number]>();
  for (const participant of row.participants ?? []) if (!isLocalParticipantId(participant.userId)) memberMap.set(participant.userId, { userId: participant.userId, alias: participant.alias, roles: ["participant"], connected: false });
  for (const judge of row.judges ?? []) {
    const member = memberMap.get(judge.userId) ?? { userId: judge.userId, alias: judge.alias, roles: [], connected: false };
    if (!member.roles.includes("judge")) member.roles.push("judge");
    memberMap.set(judge.userId, member);
  }
  for (const spectator of row.spectators ?? []) {
    const member = memberMap.get(spectator.userId) ?? { userId: spectator.userId, alias: spectator.alias, roles: [], connected: false };
    if (!member.roles.includes("spectator")) member.roles.push("spectator");
    memberMap.set(spectator.userId, member);
  }
  for (const adminId of row.adminIds) {
    const member = memberMap.get(adminId) ?? { userId: adminId, alias: "Admin", roles: [], connected: false };
    if (!member.roles.includes("admin")) member.roles.push("admin");
    memberMap.set(adminId, member);
  }

  return {
    id: row.id,
    mode: row.modeConfig as BattleModeConfig,
    status: row.status as Battle["status"],
    currentRound: row.currentRound,
    roundPhase: row.roundPhase as Battle["roundPhase"],
    currentTurn: row.currentTurn,
    currentWord: (row.currentWord as Word) ?? undefined,
    pendingEntry: (row.pendingEntry as Battle["pendingEntry"]) ?? undefined,
    timeRemaining: row.timeRemaining,
    phaseToken: row.phaseToken ?? undefined,
    phaseDeadline: row.phaseDeadline?.toISOString(),
    entriesRemaining: (row.entriesRemaining as Record<string, number>) ?? {},
    totalScores: (row.totalScores as Record<string, number>) ?? {},
    turnSequenceIndex: row.turnSequenceIndex,
    replicaCount: row.replicaCount,
    replicaConfig: (row.replicaConfig as ReplicaConfig) ?? undefined,
    hostId: row.hostId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    participants: [...(row.participants ?? [])].sort((a, b) => {
      const first = row.participantOrder.indexOf(a.userId);
      const second = row.participantOrder.indexOf(b.userId);
      return (first < 0 ? Number.MAX_SAFE_INTEGER : first) - (second < 0 ? Number.MAX_SAFE_INTEGER : second);
    }).map((p) => ({
      userId: p.userId,
      name: p.name,
      alias: p.alias,
      isActive: p.isActive,
      currentScore: p.currentScore,
      roundsWon: p.roundsWon,
    })),
    judges: (row.judges ?? []).map((j) => ({ id: j.userId, alias: j.alias })),
    spectators: (row.spectators ?? []).map((s) => ({ id: s.userId, alias: s.alias })),
    members: [...memberMap.values()],
    roundResults: (row.roundResults ?? []).map((r) => ({
      round: r.round,
      replica: r.replica,
      winnerId: r.winnerId ?? undefined,
      scores: r.scores as Record<string, number>,
      judgeVotes: (r.judgeVotes as { judgeId: string; judgeName: string; votedForId?: string }[]) ?? [],
    })),
  };
}

// --- Repository ---

export class BattlePersistence {
  private readonly battleWrites = new Map<string, Promise<unknown>>();

  async commitBattleStart(battle: Battle, sessionExpiry: Date): Promise<void> {
    const snapshot = structuredClone(battle);
    const expiresAt = new Date(sessionExpiry);
    const now = new Date();
    await this.enqueueBattleWrite(snapshot.id, () => prisma.$transaction(async tx => {
      await tx.liveBattle.update({ where: { id: snapshot.id }, data: serializeBattleUpdate(snapshot) });
      await tx.liveBattleSession.updateMany({ where: { roomId: snapshot.id, expiresAt: { gt: now } }, data: { expiresAt } });
    }));
  }

  private enqueueBattleWrite<T>(roomId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.battleWrites.get(roomId) ?? Promise.resolve();
    const current = previous.then(operation);
    this.battleWrites.set(roomId, current);
    const cleanup = () => {
      if (this.battleWrites.get(roomId) === current) this.battleWrites.delete(roomId);
    };
    void current.then(cleanup, cleanup);
    return current;
  }

  async commitRoomVotingRoster(battle: Battle, voterIds: string[]): Promise<void> {
    const snapshot = structuredClone(battle);
    const roomId = snapshot.id.toLowerCase();
    const voters = [...voterIds];
    if (new Set(voters).size !== voters.length) throw new Error("Votantes duplicados en el padrón");
    await this.enqueueBattleWrite(roomId, () => prisma.$transaction(async tx => {
      await tx.liveBattle.update({ where: { id: roomId }, data: serializeBattleUpdate(snapshot) });
      await tx.liveBattleVotingRoster.create({ data: { roomId, replica: snapshot.replicaCount, round: snapshot.currentRound, voterIds: voters } });
    }));
  }

  async getRoomVotingRoster(roomId: string, round: number, replica: number): Promise<string[] | null> {
    const id = roomId.toLowerCase();
    await this.battleWrites.get(id);
    const row = await prisma.liveBattleVotingRoster.findUnique({ where: { roomId_replica_round: { roomId: id, replica, round } } });
    return row?.voterIds ?? null;
  }

  async saveFreeVote(roomId: string, vote: FreeVote, replica: number): Promise<void> {
    const id = roomId.toLowerCase();
    const snapshot = structuredClone(vote);
    await this.enqueueBattleWrite(id, () => prisma.liveBattleFreeVote.upsert({
      where: { roomId_replica_round_judgeId: { roomId: id, replica, round: snapshot.round, judgeId: snapshot.judgeId } },
      create: { roomId: id, replica, ...snapshot },
      update: { judgeName: snapshot.judgeName, mc1Id: snapshot.mc1Id, mc2Id: snapshot.mc2Id, votedForId: snapshot.votedForId },
    }));
  }

  async getFreeVotes(roomId: string, round: number, replica: number): Promise<FreeVote[]> {
    const id = roomId.toLowerCase();
    await this.battleWrites.get(id);
    return prisma.liveBattleFreeVote.findMany({ where: { roomId: id, round, replica }, select: { judgeId: true, judgeName: true, round: true, mc1Id: true, mc2Id: true, votedForId: true } });
  }

  async saveRoomVote(roomId: string, vote: RoomVote, replica: number): Promise<void> {
    const id = roomId.toLowerCase();
    const snapshot = structuredClone(vote);
    await this.enqueueBattleWrite(id, () => prisma.liveBattleRoomVote.upsert({
      where: { roomId_replica_round_voterId: { roomId: id, replica, round: snapshot.round, voterId: snapshot.voterId } },
      create: { roomId: id, replica, ...snapshot },
      update: { voterName: snapshot.voterName, mc1Id: snapshot.mc1Id, mc2Id: snapshot.mc2Id, votedForId: snapshot.votedForId },
    }));
  }

  async getRoomVotes(roomId: string, round: number, replica: number): Promise<RoomVote[]> {
    const id = roomId.toLowerCase();
    await this.battleWrites.get(id);
    return prisma.liveBattleRoomVote.findMany({ where: { roomId: id, round, replica }, select: { voterId: true, voterName: true, round: true, mc1Id: true, mc2Id: true, votedForId: true } });
  }

  async saveSession(input: { token: string; roomId: string; userId: string; alias: string; roles: string[]; expiresAt: Date }): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(input.token)) throw new Error("Token de sesión inválido");
    const roomId = input.roomId.toLowerCase();
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const data = { userId: input.userId, alias: input.alias, roles: [...input.roles], expiresAt: new Date(input.expiresAt) };
    await this.enqueueBattleWrite(roomId, () => prisma.liveBattleSession.upsert({
      where: { roomId_tokenHash: { roomId, tokenHash } },
      create: { roomId, tokenHash, ...data },
      update: data,
    }));
  }

  async findSession(roomId: string, token: string, now?: Date): Promise<{ userId: string; alias: string; roles: string[] } | null> {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const normalizedId = roomId.toLowerCase();
    await this.battleWrites.get(normalizedId);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = await prisma.liveBattleSession.findUnique({ where: { roomId_tokenHash: { roomId: normalizedId, tokenHash } } });
    if (!session || session.expiresAt <= (now ?? new Date())) return null;
    return { userId: session.userId, alias: session.alias, roles: session.roles };
  }

  async listSessionMembers(roomId: string): Promise<Array<{ userId: string; alias: string; roles: string[] }>> {
    const normalizedId = roomId.toLowerCase();
    await this.battleWrites.get(normalizedId);
    return prisma.liveBattleSession.findMany({
      where: { roomId: normalizedId, expiresAt: { gt: new Date() } },
      select: { userId: true, alias: true, roles: true },
    });
  }

  async deleteSession(roomId: string, token: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const normalizedId = roomId.toLowerCase();
    await this.enqueueBattleWrite(normalizedId, () => prisma.liveBattleSession.deleteMany({ where: { roomId: normalizedId, tokenHash } }));
  }

  async commitMemberRoles(battle: Battle): Promise<void> {
    const roomId = battle.id.toLowerCase();
    const members = structuredClone(battle.members);
    const hostId = battle.hostId ?? null;
    const adminIds = members.filter(member => member.roles.includes("admin")).map(member => member.userId);
    const memberIds = members.map(member => member.userId);
    if (new Set(memberIds).size !== memberIds.length) throw new Error("Miembros duplicados");
    await this.enqueueBattleWrite(roomId, () => prisma.$transaction(async transaction => {
      await transaction.liveBattle.update({ where: { id: roomId }, data: { adminIds, hostId } });
      for (const member of members) {
        await transaction.liveBattleSession.updateMany({
          where: { roomId, userId: member.userId },
          data: { roles: member.roles, alias: member.alias },
        });
      }
      await transaction.liveBattleSession.deleteMany({ where: { roomId, userId: { notIn: memberIds } } });
    }));
  }

  async create(battle: Battle): Promise<Battle> {
    const snapshot = structuredClone(battle);
    await this.enqueueBattleWrite(snapshot.id, () => prisma.liveBattle.create({ data: serializeBattle(snapshot) }));
    return battle;
  }

  async findById(id: string): Promise<Battle | null> {
    const row = await prisma.liveBattle.findUnique({
      where: { id: id.toLowerCase() },
      include: {
        participants: true,
        judges: true,
        spectators: true,
        roundResults: { orderBy: [{ replica: "asc" }, { round: "asc" }] },
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
        replica: r.replica,
        winnerId: r.winnerId,
        scores: r.scores,
        judgeVotes: r.judgeVotes,
      })),
    });
  }

  async update(battle: Battle): Promise<Battle> {
    const snapshot = structuredClone(battle);
    await this.enqueueBattleWrite(snapshot.id, () => prisma.liveBattle.update({
      where: { id: snapshot.id },
      data: serializeBattleUpdate(snapshot),
    }));
    return battle;
  }

  async commitBattleAndResult(battle: Battle, result: { round: number; replica: number; scores: Record<string, number>; winnerId?: string; judgeVotes: { judgeId: string; judgeName: string; votedForId?: string }[] }): Promise<void> {
    const snapshot = structuredClone(battle);
    const savedResult = structuredClone(result);
    const roomId = snapshot.id.toLowerCase();
    await this.enqueueBattleWrite(roomId, () => prisma.$transaction(async transaction => {
      await transaction.liveBattle.update({ where: { id: roomId }, data: serializeBattleUpdate(snapshot) });
      for (const participant of snapshot.participants) {
        const updated = await transaction.liveBattleParticipant.updateMany({
          where: { roomId, userId: participant.userId },
          data: { currentScore: participant.currentScore, roundsWon: participant.roundsWon, isActive: participant.isActive },
        });
        if (updated.count !== 1) throw new Error("No se encontró un participante de la batalla");
      }
      const data = {
        winnerId: savedResult.winnerId ?? null,
        scores: savedResult.scores as Prisma.JsonObject,
        judgeVotes: savedResult.judgeVotes as unknown as Prisma.JsonArray,
      };
      await transaction.liveBattleRoundResult.upsert({
        where: { roomId_replica_round: { roomId, replica: savedResult.replica, round: savedResult.round } },
        create: { roomId, replica: savedResult.replica, round: savedResult.round, ...data },
        update: data,
      });
    }));
  }

  async delete(id: string): Promise<void> {
    const normalizedId = id.toLowerCase();
    await this.enqueueBattleWrite(normalizedId, () => prisma.liveBattle.deleteMany({ where: { id: normalizedId } }));
  }

  // --- Participants ---

  async commitLocalParticipants(battle: Battle): Promise<void> {
    const snapshot = structuredClone(battle);
    const local = snapshot.participants.filter(participant => isLocalParticipantId(participant.userId));
    await this.enqueueBattleWrite(snapshot.id, () => prisma.$transaction(async transaction => {
      await transaction.liveBattleParticipant.deleteMany({ where: { roomId: snapshot.id, userId: { startsWith: LOCAL_PARTICIPANT_PREFIX, notIn: local.map(participant => participant.userId) } } });
      for (const participant of local) {
        const { userId, ...data } = participant;
        await transaction.liveBattleParticipant.upsert({
          where: { roomId_userId: { roomId: snapshot.id, userId } },
          create: { roomId: snapshot.id, userId, ...data }, update: data,
        });
      }
      await transaction.liveBattle.update({ where: { id: snapshot.id }, data: serializeBattleUpdate(snapshot) });
    }));
  }

  async addParticipant(roomId: string, participant: Participant): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    participant = structuredClone(participant);
    await this.enqueueBattleWrite(normalizedId, () => prisma.liveBattleParticipant.upsert({
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
    }));
  }

  async removeParticipant(roomId: string, userId: string): Promise<void> {
    await this.enqueueBattleWrite(roomId.toLowerCase(), () => prisma.liveBattleParticipant.deleteMany({
      where: { roomId: roomId.toLowerCase(), userId },
    }));
  }

  // --- Judges ---

  async addJudge(roomId: string, judge: { id: string; alias: string }): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    judge = { ...judge };
    await this.enqueueBattleWrite(normalizedId, () => prisma.liveBattleJudge.upsert({
      where: { roomId_userId: { roomId: normalizedId, userId: judge.id } },
      create: { roomId: normalizedId, userId: judge.id, alias: judge.alias },
      update: { alias: judge.alias },
    }));
  }

  async removeJudge(roomId: string, userId: string): Promise<void> {
    await this.enqueueBattleWrite(roomId.toLowerCase(), () => prisma.liveBattleJudge.deleteMany({
      where: { roomId: roomId.toLowerCase(), userId },
    }));
  }

  // --- Spectators ---

  async addSpectator(roomId: string, spectator: { id: string; alias: string }): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    spectator = { ...spectator };
    await this.enqueueBattleWrite(normalizedId, () => prisma.liveBattleSpectator.upsert({
      where: { roomId_userId: { roomId: normalizedId, userId: spectator.id } },
      create: { roomId: normalizedId, userId: spectator.id, alias: spectator.alias },
      update: { alias: spectator.alias },
    }));
  }

  async removeSpectator(roomId: string, userId: string): Promise<void> {
    await this.enqueueBattleWrite(roomId.toLowerCase(), () => prisma.liveBattleSpectator.deleteMany({
      where: { roomId: roomId.toLowerCase(), userId },
    }));
  }

  // --- Rubric votes ---

  async saveRubricVote(roomId: string, vote: JudgeRubricVote, replica = 0): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    vote = structuredClone(vote);
    await this.enqueueBattleWrite(normalizedId, () => prisma.liveBattleRubricVote.upsert({
      where: { roomId_replica_round_judgeId: { roomId: normalizedId, replica, round: vote.round, judgeId: vote.judgeId } },
      create: {
        roomId: normalizedId,
        judgeId: vote.judgeId,
        judgeName: vote.judgeName,
        round: vote.round,
        replica,
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
    }));
  }

  async getRubricVotes(roomId: string, round: number, replica = 0): Promise<JudgeRubricVote[]> {
    const rows = await prisma.liveBattleRubricVote.findMany({
      where: { roomId: roomId.toLowerCase(), round, replica },
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

  async commitPatronEntryVote(battle: Battle, vote: PatronEntryVote): Promise<void> {
    const snapshot = structuredClone(battle);
    const savedVote = structuredClone(vote);
    const roomId = snapshot.id.toLowerCase();
    const replica = snapshot.replicaCount;
    await this.enqueueBattleWrite(roomId, () => prisma.$transaction(async transaction => {
      await transaction.liveBattle.update({ where: { id: roomId }, data: serializeBattleUpdate(snapshot) });
      await transaction.liveBattlePatronEntryVote.upsert({
        where: { roomId_replica_round_mcId_entryIndex_judgeId: { roomId, replica, round: savedVote.round, mcId: savedVote.mcId, entryIndex: savedVote.entryIndex, judgeId: savedVote.judgeId } },
        create: { roomId, replica, ...savedVote },
        update: { judgeName: savedVote.judgeName, points: savedVote.points },
      });
    }));
  }

  async savePatronEntryVote(roomId: string, voteKey: string, vote: PatronEntryVote, replica = 0): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    // voteKey is like "battleId:round:mcId:entryIndex"
    vote = structuredClone(vote);
    await this.enqueueBattleWrite(normalizedId, () => prisma.liveBattlePatronEntryVote.upsert({
      where: { roomId_replica_round_mcId_entryIndex_judgeId: { roomId: normalizedId, replica, round: vote.round, mcId: vote.mcId, entryIndex: vote.entryIndex, judgeId: vote.judgeId } },
      create: {
        roomId: normalizedId,
        replica,
        judgeId: vote.judgeId,
        judgeName: vote.judgeName,
        round: vote.round,
        entryIndex: vote.entryIndex,
        mcId: vote.mcId,
        points: vote.points,
      },
      update: { judgeName: vote.judgeName, points: vote.points },
    }));
  }

  async getPatronEntryVotes(roomId: string, round: number, replica = 0): Promise<PatronEntryVote[]> {
    const rows = await prisma.liveBattlePatronEntryVote.findMany({
      where: { roomId: roomId.toLowerCase(), round, replica },
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

  async deletePatronEntryVotes(roomId: string, round: number, mcId: string, entryIndex: number, replica = 0): Promise<void> {
    await this.enqueueBattleWrite(roomId.toLowerCase(), () => prisma.liveBattlePatronEntryVote.deleteMany({
      where: { roomId: roomId.toLowerCase(), round, replica, mcId, entryIndex },
    }));
  }

  // --- Patron extra votes ---

  async savePatronExtraVote(roomId: string, vote: PatronExtraVote, replica = 0): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    vote = structuredClone(vote);
    await this.enqueueBattleWrite(normalizedId, () => prisma.liveBattlePatronExtraVote.upsert({
      where: { roomId_replica_round_judgeId: { roomId: normalizedId, replica, round: vote.round, judgeId: vote.judgeId } },
      create: {
        roomId: normalizedId,
        judgeId: vote.judgeId,
        judgeName: vote.judgeName,
        round: vote.round,
        replica,
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
    }));
  }

  async getPatronExtraVotes(roomId: string, round: number, replica = 0): Promise<PatronExtraVote[]> {
    const rows = await prisma.liveBattlePatronExtraVote.findMany({
      where: { roomId: roomId.toLowerCase(), round, replica },
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
    replica = 0,
  ): Promise<void> {
    const normalizedId = roomId.toLowerCase();
    scores = structuredClone(scores);
    judgeVotes = structuredClone(judgeVotes);
    await this.enqueueBattleWrite(normalizedId, () => prisma.liveBattleRoundResult.upsert({
      where: { roomId_replica_round: { roomId: normalizedId, replica, round } },
      create: {
        roomId: normalizedId,
        round,
        replica,
        winnerId: winnerId ?? null,
        scores: scores as unknown as Prisma.JsonObject,
        judgeVotes: judgeVotes as unknown as Prisma.JsonObject,
      },
      update: {
        winnerId: winnerId ?? null,
        scores: scores as unknown as Prisma.JsonObject,
        judgeVotes: judgeVotes as unknown as Prisma.JsonObject,
      },
    }));
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
        roundResults: { orderBy: [{ replica: "asc" }, { round: "asc" }] },
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
          replica: r.replica,
          winnerId: r.winnerId,
          scores: r.scores,
          judgeVotes: r.judgeVotes,
        })),
      }),
    );
  }
}
