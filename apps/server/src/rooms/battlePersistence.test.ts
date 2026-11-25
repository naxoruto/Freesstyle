import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Battle, BattleModeConfig, JudgeRubricVote, PatronEntryVote, PatronExtraVote, ScoreRubric } from "@freestyle/shared";
import { BattlePersistence } from "./battlePersistence";
import { getDefaultModeConfig } from "../modes/modes";

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  const mode = getDefaultModeConfig("clasico");
  return {
    id: "test-battle-01",
    mode,
    status: "lobby",
    participants: [],
    judges: [],
    spectators: [],
    currentRound: 0,
    roundPhase: "countdown",
    currentTurn: "",
    timeRemaining: 0,
    entriesRemaining: {},
    totalScores: {},
    roundResults: [],
    turnSequenceIndex: 0,
    replicaCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
    members: overrides.members ?? [],
  };
}

const rubricScores = (value: number): ScoreRubric => ({
  flow: value,
  lirica: value,
  ingenio: value,
  presencia: value,
  tecnica: value,
});

describe("BattlePersistence", () => {
  const persistence = new BattlePersistence();
  const roomId = "test-persist-01";
  const testRoomIds = [roomId, "test-persist-02", "test-persist-03", "test-persist-pending", "test-persist-order", "test-persist-session", "test-persist-queue", "test-persist-queue-fail", "test-persist-join-queue", "test-persist-role-commit", "test-persist-role-rollback", "test-persist-read-after-revoke", "test-persist-expiry-wait", "test-persist-replica", "test-persist-result-atomic", "test-persist-entry-atomic", "test-persist-room-votes"];

  // Las batallas de prueba usan ids fijos: limpiar residuos de ejecuciones previas
  // para que el suite sea repetible contra la misma base de datos local.
  beforeAll(async () => {
    for (const id of testRoomIds) await persistence.delete(id);
  });

  afterAll(async () => {
    for (const id of testRoomIds) await persistence.delete(id);
  });

  it("creates and reads a battle", async () => {
    const battle = makeBattle({ id: roomId });
    await persistence.create(battle);

    const loaded = await persistence.findById(roomId);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(roomId);
    expect(loaded!.status).toBe("lobby");
    expect(loaded!.mode.mode).toBe("clasico");
  });

  it("updates battle state", async () => {
    const battle = makeBattle({ id: roomId, status: "in_progress", currentRound: 2 });
    await persistence.update(battle);

    const loaded = await persistence.findById(roomId);
    expect(loaded!.status).toBe("in_progress");
    expect(loaded!.currentRound).toBe(2);
  });

  it("commits the battle state and round result together and rolls both back on failure", async () => {
    const id = "test-persist-result-atomic";
    const battle = makeBattle({ id, status: "in_progress", currentRound: 1, roundPhase: "voting" });
    await persistence.create(battle);
    const participant = { userId: "mc1", name: "MC", alias: "MC", isActive: true, currentScore: 0, roundsWon: 0 };
    await persistence.addParticipant(id, participant);
    battle.participants = [{ ...participant, roundsWon: 1 }];
    battle.roundPhase = "round_result";
    battle.totalScores = { mc1: 10 };
    const result = { round: 1, replica: 0, scores: { mc1: 10 }, winnerId: "mc1", judgeVotes: [] };
    await expect(persistence.commitBattleAndResult(battle, { ...result, round: 2147483648 })).rejects.toThrow();
    expect(await persistence.findById(id)).toMatchObject({ roundPhase: "voting", totalScores: {}, roundResults: [], participants: [{ userId: "mc1", roundsWon: 0 }] });
    await persistence.commitBattleAndResult(battle, result);
    expect(await persistence.findById(id)).toMatchObject({ roundPhase: "round_result", totalScores: { mc1: 10 }, roundResults: [{ round: 1, replica: 0, scores: { mc1: 10 }, winnerId: "mc1" }], participants: [{ userId: "mc1", roundsWon: 1 }] });
  });

  it("manages participants", async () => {
    const participant = { userId: "mc-1", name: "MC Uno", alias: "Uno", isActive: false, currentScore: 0, roundsWon: 0 };
    await persistence.addParticipant(roomId, participant);

    const loaded = await persistence.findById(roomId);
    expect(loaded!.participants).toHaveLength(1);
    expect(loaded!.participants[0].userId).toBe("mc-1");
  });

  it("manages judges", async () => {
    await persistence.addJudge(roomId, { id: "judge-1", alias: "Juez 1" });

    const loaded = await persistence.findById(roomId);
    expect(loaded!.judges).toHaveLength(1);
    expect(loaded!.judges[0].alias).toBe("Juez 1");
  });

  it("manages spectators", async () => {
    await persistence.addSpectator(roomId, { id: "viewer-1", alias: "Publico 1" });

    const loaded = await persistence.findById(roomId);
    expect(loaded!.spectators).toHaveLength(1);
    expect(loaded!.spectators[0].alias).toBe("Publico 1");
  });

  it("saves and retrieves rubric votes", async () => {
    const vote: JudgeRubricVote = {
      judgeId: "judge-1",
      judgeName: "Juez 1",
      round: 1,
      mc1Id: "mc-1",
      mc2Id: "mc-2",
      mc1Scores: rubricScores(8),
      mc2Scores: rubricScores(5),
    };
    await persistence.saveRubricVote(roomId, vote);

    const votes = await persistence.getRubricVotes(roomId, 1);
    expect(votes).toHaveLength(1);
    expect(votes[0].judgeId).toBe("judge-1");
    expect(votes[0].mc1Scores.flow).toBe(8);
  });

  it("stores free and room votes separately by round and replica and keeps a closed roster", async () => {
    const id = "test-persist-room-votes";
    const battle = makeBattle({ id, status: "in_progress", currentRound: 1, roundPhase: "mc2_turn" });
    await persistence.create(battle);
    battle.roundPhase = "voting";
    await persistence.commitRoomVotingRoster(battle, ["viewer-1", "viewer-2"]);
    expect(await persistence.getRoomVotingRoster(id, 1, 0)).toEqual(["viewer-1", "viewer-2"]);
    const changed = { ...battle, currentTurn: "should-rollback" };
    await expect(persistence.commitRoomVotingRoster(changed, ["other-viewer"])).rejects.toThrow();
    expect(await persistence.findById(id)).toMatchObject({ currentTurn: "" });
    expect(await persistence.getRoomVotingRoster(id, 1, 0)).toEqual(["viewer-1", "viewer-2"]);
    const free = { judgeId: "judge-1", judgeName: "Juez", round: 1, mc1Id: "a", mc2Id: "b", votedForId: "a" };
    const room = { voterId: "viewer-1", voterName: "Público", round: 1, mc1Id: "a", mc2Id: "b", votedForId: "b" };
    await persistence.saveFreeVote(id, free, 0);
    await persistence.saveFreeVote(id, { ...free, votedForId: "b" }, 1);
    await persistence.saveRoomVote(id, room, 0);
    await persistence.saveRoomVote(id, { ...room, votedForId: "a" }, 0);
    expect(await persistence.getFreeVotes(id, 1, 0)).toEqual([free]);
    expect(await persistence.getFreeVotes(id, 1, 1)).toEqual([{ ...free, votedForId: "b" }]);
    expect(await persistence.getRoomVotes(id, 1, 0)).toEqual([{ ...room, votedForId: "a" }]);
    expect(await persistence.getRoomVotingRoster(id, 1, 1)).toBeNull();
  });

  it("saves and retrieves patron entry votes", async () => {
    const vote: PatronEntryVote = {
      judgeId: "judge-1",
      judgeName: "Juez 1",
      round: 1,
      entryIndex: 0,
      mcId: "mc-1",
      points: 3,
    };
    await persistence.savePatronEntryVote(roomId, "test:1:mc-1:0", vote);

    const votes = await persistence.getPatronEntryVotes(roomId, 1);
    expect(votes.length).toBeGreaterThanOrEqual(1);
    expect(votes.some((v) => v.points === 3)).toBe(true);
  });

  it("commits a patron entry vote together with its phase change", async () => {
    const id = "test-persist-entry-atomic";
    const battle = makeBattle({ id, status: "in_progress", currentRound: 1, roundPhase: "entry_voting", pendingEntry: { mcId: "mc-1", entryIndex: 0 } });
    await persistence.create(battle);
    battle.roundPhase = "pause";
    battle.pendingEntry = undefined;
    const vote = { judgeId: "judge-1", judgeName: "Juez", round: 1, entryIndex: 0, mcId: "mc-1", points: 3 };
    await expect(persistence.commitPatronEntryVote(battle, { ...vote, entryIndex: 2147483648 })).rejects.toThrow();
    expect(await persistence.findById(id)).toMatchObject({ roundPhase: "entry_voting", pendingEntry: { mcId: "mc-1", entryIndex: 0 } });
    expect(await persistence.getPatronEntryVotes(id, 1)).toHaveLength(0);
    await persistence.commitPatronEntryVote(battle, vote);
    expect(await persistence.findById(id)).toMatchObject({ roundPhase: "pause", pendingEntry: undefined });
    expect(await persistence.getPatronEntryVotes(id, 1)).toMatchObject([vote]);
  });

  it("restores and clears the pending entry during patron voting", async () => {
    const id = "test-persist-pending";
    const battle = makeBattle({ id, status: "in_progress", roundPhase: "entry_voting", pendingEntry: { mcId: "mc-1", entryIndex: 2 } });
    await persistence.create(battle);
    expect((await persistence.findById(id))?.pendingEntry).toEqual({ mcId: "mc-1", entryIndex: 2 });
    battle.pendingEntry = undefined;
    await persistence.update(battle);
    expect((await persistence.findById(id))?.pendingEntry).toBeUndefined();
  });

  it("restores the battle's current participant order", async () => {
    const id = "test-persist-order";
    const first = { userId: "mc-a", name: "A", alias: "A", isActive: false, currentScore: 0, roundsWon: 0 };
    const second = { userId: "mc-b", name: "B", alias: "B", isActive: false, currentScore: 0, roundsWon: 0 };
    const battle = makeBattle({ id });
    await persistence.create(battle);
    await persistence.addParticipant(id, first);
    await persistence.addParticipant(id, second);
    battle.participants = [second, first];
    await persistence.update(battle);
    expect((await persistence.findById(id))?.participants.map(p => p.userId)).toEqual(["mc-b", "mc-a"]);
  });

  it("persists revocable, room-scoped sessions without storing the token", async () => {
    const { prisma } = await import("../db/prisma");
    const id = "test-persist-session";
    const token = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const store = persistence;
    await persistence.create(makeBattle({ id }));
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    await store.saveSession({ token, roomId: id, userId: "admin-1", alias: "Admin", roles: ["admin", "judge"], expiresAt });
    expect(await store.findSession(id, token, new Date("2029-01-01T00:00:00.000Z"))).toMatchObject({ userId: "admin-1", alias: "Admin", roles: ["admin", "judge"] });
    expect(await store.findSession("other-room", token, new Date("2029-01-01T00:00:00.000Z"))).toBeNull();
    expect(await store.findSession(id, "invalid", new Date("2029-01-01T00:00:00.000Z"))).toBeNull();
    expect(await store.findSession(id, token, expiresAt)).toBeNull();
    const rows = await prisma.$queryRaw<{ token_hash: string }[]>`SELECT token_hash FROM live_battle_sessions WHERE room_id = ${id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(createHash("sha256").update(token).digest("hex"));
    await store.saveSession({ token, roomId: id, userId: "admin-1", alias: "Admin", roles: ["judge"], expiresAt });
    expect(await store.findSession(id, token, new Date("2029-01-01T00:00:00.000Z"))).toMatchObject({ roles: ["judge"] });
    await store.deleteSession("other-room", token);
    expect(await store.findSession(id, token, new Date("2029-01-01T00:00:00.000Z"))).not.toBeNull();
    await store.deleteSession(id, token);
    expect(await store.findSession(id, token, new Date("2029-01-01T00:00:00.000Z"))).toBeNull();
  });

  it("commits role changes to every session and revokes removed members", async () => {
    const id = "test-persist-role-commit";
    const token1 = "a".repeat(64);
    const token2 = "b".repeat(64);
    const removedToken = "c".repeat(64);
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const now = new Date("2029-01-01T00:00:00.000Z");
    const battle = makeBattle({ id, members: [{ userId: "former-admin", alias: "Admin", roles: ["admin", "judge"], connected: true }] });
    await persistence.create(battle);
    for (const token of [token1, token2]) await persistence.saveSession({ roomId: id, token, userId: "former-admin", alias: "Admin", roles: ["admin", "judge"], expiresAt });
    await persistence.saveSession({ roomId: id, token: removedToken, userId: "removed", alias: "Removed", roles: ["spectator"], expiresAt });
    battle.members = [{ userId: "former-admin", alias: "Admin", roles: ["judge"], connected: true }];
    await persistence.commitMemberRoles(battle);
    for (const token of [token1, token2]) expect(await persistence.findSession(id, token, now)).toMatchObject({ roles: ["judge"] });
    expect(await persistence.findSession(id, removedToken, now)).toBeNull();
    const { prisma } = await import("../db/prisma");
    expect((await prisma.liveBattle.findUniqueOrThrow({ where: { id } })).adminIds).toEqual([]);
  });

  it("rolls back both session roles and administrators if a role commit fails", async () => {
    const id = "test-persist-role-rollback";
    const token = "d".repeat(64);
    const battle = makeBattle({ id, members: [{ userId: "admin", alias: "Admin", roles: ["admin"], connected: true }] });
    await persistence.create(battle);
    await persistence.saveSession({ roomId: id, token, userId: "admin", alias: "Admin", roles: ["admin"], expiresAt: new Date("2030-01-01T00:00:00.000Z") });
    battle.members = [
      { userId: "admin", alias: "Admin", roles: ["judge"], connected: true },
      { userId: "invalid", alias: null as unknown as string, roles: [], connected: true },
    ];
    await expect(persistence.commitMemberRoles(battle)).rejects.toThrow();
    expect(await persistence.findSession(id, token, new Date("2029-01-01T00:00:00.000Z"))).toMatchObject({ roles: ["admin"] });
    const { prisma } = await import("../db/prisma");
    expect((await prisma.liveBattle.findUniqueOrThrow({ where: { id } })).adminIds).toEqual(["admin"]);
  });

  it("waits for a pending revocation before reading a session", async () => {
    const { prisma } = await import("../db/prisma");
    const id = "test-persist-read-after-revoke";
    const token = "e".repeat(64);
    await persistence.create(makeBattle({ id }));
    await persistence.saveSession({ roomId: id, token, userId: "admin", alias: "Admin", roles: ["admin"], expiresAt: new Date("2030-01-01T00:00:00.000Z") });
    const originalDelete = prisma.liveBattleSession.deleteMany.bind(prisma.liveBattleSession);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const delayedDelete = async (args: Parameters<typeof prisma.liveBattleSession.deleteMany>[0]) => { await gate; return originalDelete(args); };
    const deletion = vi.spyOn(prisma.liveBattleSession, "deleteMany").mockImplementation(delayedDelete as unknown as typeof prisma.liveBattleSession.deleteMany);
    const lookup = vi.spyOn(prisma.liveBattleSession, "findUnique");
    let revoke: Promise<void> | undefined;
    let read: ReturnType<typeof persistence.findSession> | undefined;
    try {
      revoke = persistence.deleteSession(id, token);
      read = persistence.findSession(id, token, new Date("2029-01-01T00:00:00.000Z"));
      await Promise.resolve();
      expect(lookup).not.toHaveBeenCalled();
      release();
      await revoke;
      expect(await read).toBeNull();
    } finally {
      release();
      await Promise.allSettled([...(revoke ? [revoke] : []), ...(read ? [read] : [])]);
      deletion.mockRestore();
      lookup.mockRestore();
    }
  });

  it("rejects a session that expires while waiting for a pending write", async () => {
    const { prisma } = await import("../db/prisma");
    const id = "test-persist-expiry-wait";
    const token = "f".repeat(64);
    const battle = makeBattle({ id });
    await persistence.create(battle);
    await persistence.saveSession({ roomId: id, token, userId: "admin", alias: "Admin", roles: ["admin"], expiresAt: new Date(Date.now() + 300) });
    const originalUpdate = prisma.liveBattle.update.bind(prisma.liveBattle);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const delayedUpdate = async (args: Parameters<typeof prisma.liveBattle.update>[0]) => { await gate; return originalUpdate(args); };
    const update = vi.spyOn(prisma.liveBattle, "update").mockImplementation(delayedUpdate as unknown as typeof prisma.liveBattle.update);
    let write: Promise<Battle> | undefined;
    let read: ReturnType<typeof persistence.findSession> | undefined;
    try {
      write = persistence.update(battle);
      read = persistence.findSession(id, token);
      await new Promise(resolve => setTimeout(resolve, 450));
      release();
      await write;
      expect(await read).toBeNull();
    } finally {
      release();
      await Promise.allSettled([...(write ? [write] : []), ...(read ? [read] : [])]);
      update.mockRestore();
    }
  });

  it("serializes concurrent battle updates and captures each state at submission", async () => {
    const { prisma } = await import("../db/prisma");
    const id = "test-persist-queue";
    const battle = makeBattle({ id });
    await persistence.create(battle);
    const originalUpdate = prisma.liveBattle.update.bind(prisma.liveBattle);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let calls = 0;
    const delayedUpdate = async (args: Parameters<typeof prisma.liveBattle.update>[0]) => {
      if (++calls === 1) await gate;
      return originalUpdate(args);
    };
    const update = vi.spyOn(prisma.liveBattle, "update").mockImplementation(delayedUpdate as unknown as typeof prisma.liveBattle.update);
    try {
      battle.status = "in_progress";
      const first = persistence.update(battle);
      battle.status = "finished";
      const second = persistence.update(battle);
      await Promise.resolve();
      expect(update).toHaveBeenCalledTimes(1);
      release();
      await Promise.all([first, second]);
      expect((await persistence.findById(id))?.status).toBe("finished");
    } finally {
      release();
      update.mockRestore();
    }
  });

  it("does not execute a queued update after an earlier write fails", async () => {
    const { prisma } = await import("../db/prisma");
    const battle = makeBattle({ id: "test-persist-queue-fail" });
    await persistence.create(battle);
    const failure = async () => { throw new Error("database unavailable"); };
    const update = vi.spyOn(prisma.liveBattle, "update").mockImplementation(failure as unknown as typeof prisma.liveBattle.update);
    try {
      const first = persistence.update(battle);
      const second = persistence.update(battle);
      const results = await Promise.allSettled([first, second]);
      expect(results.map(result => result.status)).toEqual(["rejected", "rejected"]);
      expect(update).toHaveBeenCalledTimes(1);
    } finally {
      update.mockRestore();
    }
  });

  it("waits for battle creation before saving a participant", async () => {
    const { prisma } = await import("../db/prisma");
    const battle = makeBattle({ id: "test-persist-join-queue" });
    const originalCreate = prisma.liveBattle.create.bind(prisma.liveBattle);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const delayedCreate = async (args: Parameters<typeof prisma.liveBattle.create>[0]) => { await gate; return originalCreate(args); };
    const create = vi.spyOn(prisma.liveBattle, "create").mockImplementation(delayedCreate as unknown as typeof prisma.liveBattle.create);
    const participantWrite = vi.spyOn(prisma.liveBattleParticipant, "upsert");
    try {
      const first = persistence.create(battle);
      const second = persistence.addParticipant(battle.id, { userId: "mc", name: "MC", alias: "MC", isActive: false, currentScore: 0, roundsWon: 0 });
      await Promise.resolve();
      expect(participantWrite).not.toHaveBeenCalled();
      release();
      await Promise.all([first, second]);
      expect((await persistence.findById(battle.id))?.participants).toHaveLength(1);
    } finally {
      release();
      create.mockRestore();
      participantWrite.mockRestore();
    }
  });

  it("saves and retrieves patron extra votes", async () => {
    const vote: PatronExtraVote = {
      judgeId: "judge-1",
      judgeName: "Juez 1",
      round: 1,
      mc1Id: "mc-1",
      mc2Id: "mc-2",
      mc1Extra: 2,
      mc2Extra: 1,
    };
    await persistence.savePatronExtraVote(roomId, vote);

    const votes = await persistence.getPatronExtraVotes(roomId, 1);
    expect(votes).toHaveLength(1);
    expect(votes[0].mc1Extra).toBe(2);
  });

  it("keeps votes and round results separate between the original and a replica", async () => {
    const id = "test-persist-replica";
    await persistence.create(makeBattle({ id }));
    const rubric: JudgeRubricVote = { judgeId: "judge", judgeName: "Judge", round: 1, mc1Id: "a", mc2Id: "b", mc1Scores: rubricScores(5), mc2Scores: rubricScores(5) };
    await persistence.saveRubricVote(id, rubric, 0);
    await persistence.saveRubricVote(id, { ...rubric, mc1Scores: rubricScores(8) }, 1);
    expect((await persistence.getRubricVotes(id, 1, 0))[0].mc1Scores.flow).toBe(5);
    expect((await persistence.getRubricVotes(id, 1, 1))[0].mc1Scores.flow).toBe(8);
    const entry: PatronEntryVote = { judgeId: "judge", judgeName: "Judge", round: 1, entryIndex: 0, mcId: "a", points: 1 };
    await persistence.savePatronEntryVote(id, "unused", entry, 0);
    await persistence.savePatronEntryVote(id, "unused", { ...entry, points: 4 }, 1);
    await persistence.savePatronEntryVote(id, "unused", { ...entry, points: 3 }, 1);
    expect((await persistence.getPatronEntryVotes(id, 1, 0)).map(vote => vote.points)).toEqual([1]);
    expect((await persistence.getPatronEntryVotes(id, 1, 1)).map(vote => vote.points)).toEqual([3]);
    const extra: PatronExtraVote = { judgeId: "judge", judgeName: "Judge", round: 1, mc1Id: "a", mc2Id: "b", mc1Extra: 1, mc2Extra: 0 };
    await persistence.savePatronExtraVote(id, extra, 0);
    await persistence.savePatronExtraVote(id, { ...extra, mc1Extra: 4 }, 1);
    expect((await persistence.getPatronExtraVotes(id, 1, 0))[0].mc1Extra).toBe(1);
    expect((await persistence.getPatronExtraVotes(id, 1, 1))[0].mc1Extra).toBe(4);
    await persistence.saveRoundResult(id, 1, { a: 1 }, "a", [], 0);
    await persistence.saveRoundResult(id, 1, { b: 2 }, "b", [], 1);
    expect((await persistence.findById(id))?.roundResults).toHaveLength(2);
  });

  it("saves and retrieves round results", async () => {
    await persistence.saveRoundResult(roomId, 1, { "mc-1": 40, "mc-2": 25 }, "mc-1", [
      { judgeId: "judge-1", judgeName: "Juez 1", votedForId: "mc-1" },
    ]);

    const loaded = await persistence.findById(roomId);
    expect(loaded!.roundResults).toHaveLength(1);
    expect(loaded!.roundResults[0].winnerId).toBe("mc-1");
    expect(loaded!.roundResults[0].scores).toEqual({ "mc-1": 40, "mc-2": 25 });
  });

  it("loads active battles excluding finished ones", async () => {
    await persistence.update(makeBattle({ id: roomId, status: "finished" }));

    const activeBattles = await persistence.loadActiveBattles();
    expect(activeBattles.every((b) => b.id !== roomId)).toBe(true);
  });

  it("removes participants and judges", async () => {
    const room2 = "test-persist-02";
    await persistence.create(makeBattle({ id: room2 }));
    await persistence.addParticipant(room2, { userId: "mc-x", name: "X", alias: "X", isActive: false, currentScore: 0, roundsWon: 0 });
    await persistence.addJudge(room2, { id: "judge-x", alias: "JX" });

    await persistence.removeParticipant(room2, "mc-x");
    await persistence.removeJudge(room2, "judge-x");

    const loaded = await persistence.findById(room2);
    expect(loaded!.participants).toHaveLength(0);
    expect(loaded!.judges).toHaveLength(0);

    await persistence.delete(room2);
  });

  it("deletes a battle", async () => {
    const room3 = "test-persist-03";
    await persistence.create(makeBattle({ id: room3 }));
    await persistence.delete(room3);

    const loaded = await persistence.findById(room3);
    expect(loaded).toBeNull();
  });

  it("reports database errors while deleting a battle", async () => {
    const { prisma } = await import("../db/prisma");
    const failure = async () => { throw new Error("database unavailable"); };
    const remove = vi.spyOn(prisma.liveBattle, "deleteMany").mockImplementation(failure as unknown as typeof prisma.liveBattle.deleteMany);
    try {
      await expect(persistence.delete("test-persist-03")).rejects.toThrow("database unavailable");
    } finally {
      remove.mockRestore();
    }
  });
});
