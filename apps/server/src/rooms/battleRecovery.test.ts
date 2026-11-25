import { afterAll, describe, expect, it } from "vitest";
import { BattleRoomManager } from "./battleRoom";
import { prisma } from "../db/prisma";
import { BattlePersistence } from "./battlePersistence";

const roomIds: string[] = [];

afterAll(async () => {
  await prisma.liveBattle.deleteMany({ where: { id: { in: roomIds } } });
});

describe("durable lobby sessions", () => {
  it("restores an administrator with their token after restarting the manager", async () => {
    const original = new BattleRoomManager();
    const room = await original.createBattleDurably();
    roomIds.push(room.id);
    const adminToken = original.getAdminToken(room.id);
    expect(original.joinBattle(room.id, "admin-old", { id: "admin-1", name: "Admin", alias: "Admin", role: "admin" }, adminToken)).toBeTruthy();
    const sessionToken = original.getSessionId("admin-old")!;
    await original.persistSessionForSocket("admin-old");
    await original.persistMemberRoles(room.id);

    const restored = new BattleRoomManager();
    await restored.loadLobbyBattlesFromDb();
    expect(await restored.reconnectPersisted(room.id, "f".repeat(64), "attacker")).toHaveProperty("error");
    const result = await restored.reconnectPersisted(room.id, sessionToken, "admin-new");
    expect(result).toHaveProperty("battle.id", room.id);
    expect(restored.getSocketMember("admin-new")).toMatchObject({ userId: "admin-1", roles: ["admin"] });
    expect(restored.canControlBattle("admin-new", restored.listBattles().find(b => b.id === room.id)!)).toBe(true);
  });

  it("keeps revoked admin permissions revoked after restart", async () => {
    const original = new BattleRoomManager();
    const room = await original.createBattleDurably();
    roomIds.push(room.id);
    original.joinBattle(room.id, "admin-old", { id: "admin-1", name: "Admin", alias: "Admin", role: "admin" }, original.getAdminToken(room.id));
    await original.persistSessionForSocket("admin-old");
    await original.persistMemberRoles(room.id);
    original.joinBattle(room.id, "guest-old", { id: "guest-1", name: "Guest", alias: "Guest" });
    const guestToken = original.getSessionId("guest-old")!;
    await original.persistSessionForSocket("guest-old");
    await original.persistMemberRoles(room.id);
    expect(original.changeRole("admin-old", "guest-1", "participant")).toHaveProperty("id", room.id);
    await original.persistMemberRoles(room.id);
    expect(original.grantAdmin("admin-old", "guest-1")).toHaveProperty("id", room.id);
    await original.persistMemberRoles(room.id);
    expect(original.revokeAdmin("admin-old", "guest-1")).toHaveProperty("id", room.id);
    await original.persistMemberRoles(room.id);

    const restored = new BattleRoomManager();
    await restored.loadLobbyBattlesFromDb();
    const result = await restored.reconnectPersisted(room.id, guestToken, "guest-new");
    expect(result).toHaveProperty("battle.id", room.id);
    expect(restored.getSocketMember("guest-new")?.roles).toEqual(["participant"]);
    expect(restored.canControlBattle("guest-new", restored.listBattles().find(b => b.id === room.id)!)).toBe(false);
  });

  it("does not restore a revoked session", async () => {
    const original = new BattleRoomManager();
    const room = await original.createBattleDurably();
    roomIds.push(room.id);
    original.joinBattle(room.id, "guest-old", { id: "guest-1", name: "Guest", alias: "Guest" });
    const token = original.getSessionId("guest-old")!;
    await original.persistSessionForSocket("guest-old");
    await original.persistMemberRoles(room.id);
    await original.revokePersistedSession(room.id, token);
    const restored = new BattleRoomManager();
    await restored.loadLobbyBattlesFromDb();
    expect(await restored.reconnectPersisted(room.id, token, "guest-new")).toHaveProperty("error");
  });

  it("does not restore an expired session", async () => {
    const original = new BattleRoomManager();
    const room = await original.createBattleDurably();
    roomIds.push(room.id);
    original.joinBattle(room.id, "guest-old", { id: "guest-1", name: "Guest", alias: "Guest" });
    const token = original.getSessionId("guest-old")!;
    await original.persistSessionForSocket("guest-old");
    await original.persistMemberRoles(room.id);
    await prisma.liveBattleSession.updateMany({ where: { roomId: room.id }, data: { expiresAt: new Date(0) } });
    const restored = new BattleRoomManager();
    await restored.loadLobbyBattlesFromDb();
    expect(await restored.reconnectPersisted(room.id, token, "guest-new")).toHaveProperty("error");
  });

  it("rejects session permissions that are no longer authorized by the room", async () => {
    const original = new BattleRoomManager();
    const room = await original.createBattleDurably();
    roomIds.push(room.id);
    const token = "f".repeat(64);
    const { BattlePersistence } = await import("./battlePersistence");
    const store = new BattlePersistence();
    await store.saveSession({ roomId: room.id, token, userId: "stranger", alias: "Stranger", roles: ["admin"], expiresAt: new Date(Date.now() + 60_000) });
    const restored = new BattleRoomManager();
    await restored.loadLobbyBattlesFromDb();
    expect(await restored.reconnectPersisted(room.id, token, "stranger-socket")).toHaveProperty("error");
  });

  it("preserves an offline participant when another member joins after restart", async () => {
    const original = new BattleRoomManager();
    const room = await original.createBattleDurably();
    roomIds.push(room.id);
    original.joinBattle(room.id, "admin-old", { id: "admin-1", name: "Admin", alias: "Admin", role: "admin" }, original.getAdminToken(room.id));
    const adminToken = original.getSessionId("admin-old")!;
    await original.persistSessionForSocket("admin-old");
    await original.persistMemberRoles(room.id);
    original.joinBattle(room.id, "guest-old", { id: "guest-1", name: "Guest", alias: "Guest" });
    const guestToken = original.getSessionId("guest-old")!;
    await original.persistSessionForSocket("guest-old");
    expect(original.changeRole("admin-old", "guest-1", "participant")).toHaveProperty("id", room.id);
    await original.persistMemberRoles(room.id);

    const restored = new BattleRoomManager();
    await restored.loadLobbyBattlesFromDb();
    expect(await restored.reconnectPersisted(room.id, adminToken, "admin-new")).toHaveProperty("battle.id", room.id);
    restored.joinBattle(room.id, "new-guest", { id: "guest-2", name: "New", alias: "New" });
    await restored.persistSessionForSocket("new-guest");
    await restored.persistMemberRoles(room.id);
    const afterSecondRestart = new BattleRoomManager();
    await afterSecondRestart.loadLobbyBattlesFromDb();
    expect(await afterSecondRestart.reconnectPersisted(room.id, guestToken, "guest-new")).toHaveProperty("battle.id", room.id);
    expect(afterSecondRestart.getSocketMember("guest-new")?.roles).toEqual(["participant"]);
  });
});

describe("active battle recovery preparation", () => {
  it("commits the start and its longer session expiry together", async () => {
    const manager = new BattleRoomManager();
    const battle = await manager.createBattleDurably(); roomIds.push(battle.id);
    manager.joinBattle(battle.id, "admin", { id: "admin", name: "Admin", alias: "Admin", role: "admin" }, manager.getAdminToken(battle.id));
    await manager.persistSessionForSocket("admin");
    const before = await prisma.liveBattleSession.findFirstOrThrow({ where: { roomId: battle.id } });
    const snapshot = { ...battle, status: "in_progress" as const };
    const store = new BattlePersistence();
    await expect(store.commitBattleStart(snapshot, new Date(NaN))).rejects.toThrow();
    expect((await store.findById(battle.id))?.status).toBe("lobby");
    expect((await prisma.liveBattleSession.findFirstOrThrow({ where: { roomId: battle.id } })).expiresAt).toEqual(before.expiresAt);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await store.commitBattleStart(snapshot, expiresAt);
    expect((await store.findById(battle.id))?.status).toBe("in_progress");
    expect((await prisma.liveBattleSession.findFirstOrThrow({ where: { roomId: battle.id } })).expiresAt).toEqual(expiresAt);
  });
  it.each(["rubrica", "free_vote", "room_vote", "patron"] as const)("restarts and resumes an incomplete %s vote with its existing votes", async votingSystem => {
    const original = new BattleRoomManager();
    const battle = await original.createBattleDurably({ votingSystem, rounds: 1, firstTurnParticipantId: "mc1", ...(votingSystem === "patron" ? { timerMode: "manual", entriesPerParticipant: 2 } : {}) });
    roomIds.push(battle.id);
    const sessions: Array<{ id: string; token: string }> = [];
    for (const [id, role] of [["admin", "admin"], ["mc1", "participant"], ["mc2", "participant"], ["j1", "judge"], ["j2", "judge"], ["j3", "judge"]] as const) {
      original.joinBattle(battle.id, id, { id, name: id, alias: id, role }, role === "admin" ? original.getAdminToken(battle.id) : undefined);
      await original.persistSessionForSocket(id);
      await original.persistMemberRoles(battle.id);
      sessions.push({ id, token: original.getSessionId(id)! });
    }
    let lateSession: string | undefined;
    if (votingSystem === "free_vote") {
      original.joinBattle(battle.id, "viewer", { id: "viewer", name: "Viewer", alias: "Viewer", role: "spectator" });
      await original.persistSessionForSocket("viewer");
      await original.persistMemberRoles(battle.id);
      lateSession = original.getSessionId("viewer");
    }
    await original.startBattleDurably("admin");
    const score = { flow: 8, lirica: 8, ingenio: 8, presencia: 8, tecnica: 8 };
    if (votingSystem === "patron") {
      await original.nextPhaseDurably(battle.id);
      await original.completeEntryDurably("admin");
      await original.submitPatronEntryVoteDurably(battle.id, "j1", 4);
    } else {
      for (let i = 0; i < 4; i++) await original.nextPhaseDurably(battle.id);
      if (votingSystem === "rubrica") await original.submitRubricVoteDurably(battle.id, "j1", 1, "mc1", "mc2", score, score);
      if (votingSystem === "free_vote") await original.submitFreeVoteDurably(battle.id, "j1", "mc1");
      if (votingSystem === "room_vote") await original.submitRoomVoteDurably("j1", battle.id, "mc1");
    }
    const restored = new BattleRoomManager();
    await restored.loadActiveBattlesFromDb();
    for (const session of sessions) expect(await restored.reconnectPersisted(battle.id, session.token, `new-${session.id}`)).toHaveProperty("battle.id", battle.id);
    expect(await restored.resumeBattleDurably("new-admin", "continue")).toHaveProperty("battle.id", battle.id);
    expect(restored.isRecoveryPaused(battle.id)).toBe(false);
    if (lateSession) expect(await restored.reconnectPersisted(battle.id, lateSession, "late-viewer")).toHaveProperty("battle.id", battle.id);
    if (votingSystem === "patron") {
      await restored.submitPatronEntryVoteDurably(battle.id, "j2", 3);
      expect(await restored.submitPatronEntryVoteDurably(battle.id, "j3", 2)).toMatchObject({ allVoted: true });
    } else {
      for (const judge of ["j2", "j3"]) {
        if (votingSystem === "rubrica") await restored.submitRubricVoteDurably(battle.id, judge, 1, "mc1", "mc2", score, score);
        if (votingSystem === "free_vote") await restored.submitFreeVoteDurably(battle.id, judge, "mc1");
        if (votingSystem === "room_vote") await restored.submitRoomVoteDurably(`new-${judge}`, battle.id, "mc1");
      }
      if (votingSystem === "room_vote") await restored.submitRoomVoteDurably("new-admin", battle.id, "mc1");
      expect(restored.isVotingComplete(battle.id)).toBe(true);
      expect(await restored.nextPhaseDurably(battle.id)).toMatchObject({ phase: "round_result" });
      const saved = await new BattlePersistence().findById(battle.id);
      expect(saved?.roundResults).toHaveLength(1);
      expect(await restored.nextPhaseDurably(battle.id, "stale-token")).toHaveProperty("error");
      expect((await new BattlePersistence().findById(battle.id))?.roundResults).toHaveLength(1);
    }
  });
  it("recovers a saved phase deadline without scheduling or advancing an expired phase", async () => {
    const original = new BattleRoomManager();
    const battle = await original.createBattleDurably();
    roomIds.push(battle.id);
    battle.status = "in_progress";
    battle.roundPhase = "countdown";
    battle.phaseToken = "saved-transition";
    battle.phaseDeadline = "2026-11-22T10:00:04.000Z";
    await new BattlePersistence().update(battle);
    const restored = new BattleRoomManager();
    await restored.loadActiveBattlesFromDb();
    expect(restored.getPhaseToken(battle.id)).toBe("saved-transition");
    expect(restored.getPhaseTiming(battle.id, Date.parse("2026-11-22T10:00:02.100Z"))).toMatchObject({ state: "pending", timeRemaining: 2 });
    expect(restored.getPhaseTiming(battle.id, Date.parse("2026-11-22T10:00:05Z"))).toMatchObject({ state: "expired", timeRemaining: 0 });
    expect(restored.isRecoveryPaused(battle.id)).toBe(true);
    expect(restored["phaseTimers"].has(battle.id)).toBe(false);
    expect(await restored.nextPhaseDurably(battle.id, "saved-transition", true)).toHaveProperty("error");
    expect(restored.listBattles().find(item => item.id === battle.id)?.roundPhase).toBe("countdown");
    battle.phaseDeadline = undefined;
    battle.phaseToken = undefined;
    await new BattlePersistence().update(battle);
    const legacy = new BattleRoomManager();
    await legacy.loadActiveBattlesFromDb();
    expect(legacy.getPhaseTiming(battle.id)).toEqual({ state: "unknown" });
  });
  it("loads persisted votes for the current round and replica, including entry votes", async () => {
    const original = new BattleRoomManager();
    const battle = await original.createBattleDurably();
    roomIds.push(battle.id);
    const store = new BattlePersistence();
    battle.status = "replica";
    battle.replicaCount = 2;
    battle.currentRound = 1;
    battle.roundPhase = "entry_voting";
    battle.pendingEntry = { mcId: "mc1", entryIndex: 1 };
    await store.update(battle);
    const score = { flow: 7, lirica: 7, ingenio: 7, presencia: 7, tecnica: 7 };
    const rubric = { judgeId: "judge", judgeName: "Juez", round: 1, mc1Id: "mc1", mc2Id: "mc2", mc1Scores: score, mc2Scores: score };
    const entry = { judgeId: "judge", judgeName: "Juez", round: 1, mcId: "mc1", entryIndex: 1, points: 3 };
    const extra = { judgeId: "judge", judgeName: "Juez", round: 1, mc1Id: "mc1", mc2Id: "mc2", mc1Extra: 2, mc2Extra: 1 };
    const free = { judgeId: "judge", judgeName: "Juez", round: 1, mc1Id: "mc1", mc2Id: "mc2", votedForId: "mc1" };
    await store.saveRubricVote(battle.id, { ...rubric, judgeId: "old-judge" }, 0);
    await store.saveRubricVote(battle.id, rubric, 2);
    await store.savePatronEntryVote(battle.id, "unused", entry, 2);
    await store.savePatronExtraVote(battle.id, extra, 2);
    await store.saveFreeVote(battle.id, free, 2);
    const restored = new BattleRoomManager();
    await restored.loadActiveBattlesFromDb();
    const key = `${battle.id}:2:1`;
    expect(restored.listBattles().find(item => item.id === battle.id)).toMatchObject({ status: "replica", pendingEntry: { mcId: "mc1", entryIndex: 1 } });
    expect(restored["rubricVotes"].get(key)).toEqual([rubric]);
    expect(restored["patronEntryVotes"].get(`${key}:mc1:1`)).toEqual([entry]);
    expect(restored["patronExtraVotes"].get(key)).toEqual([extra]);
    expect(restored["freeVotes"].get(key)).toEqual([free]);
    expect(restored.isRecoveryPaused(battle.id)).toBe(true);
  });

  it("reconstructs a paused room vote and its closed roster without allowing progress", async () => {
    const original = new BattleRoomManager();
    const room = await original.createBattleDurably({ rounds: 1, votingSystem: "room_vote" });
    roomIds.push(room.id);
    original.joinBattle(room.id, "admin-old", { id: "admin-active", name: "Admin", alias: "Admin", role: "admin" }, original.getAdminToken(room.id));
    const token = original.getSessionId("admin-old")!;
    await original.persistSessionForSocket("admin-old");
    await original.persistMemberRoles(room.id);
    for (const [socket, id] of [["mc1-old", "mc1-active"], ["mc2-old", "mc2-active"], ["viewer-old", "viewer-active"]]) {
      original.joinBattle(room.id, socket, { id, name: id, alias: id });
      await original.persistSessionForSocket(socket);
      expect(original.changeRole("admin-old", id, id.startsWith("mc") ? "participant" : "spectator")).toHaveProperty("id", room.id);
      await original.persistMemberRoles(room.id);
    }
    await original.startBattleDurably("admin-old");
    for (let i = 0; i < 4; i++) await original.nextPhaseDurably(room.id);
    await original.submitRoomVoteDurably("viewer-old", room.id, "mc1-active");
    const restored = new BattleRoomManager();
    await restored.loadActiveBattlesFromDb();
    const recovered = restored.listBattles().find(battle => battle.id === room.id)!;
    expect(recovered).toMatchObject({ status: "in_progress", roundPhase: "voting" });
    expect(restored.isRecoveryPaused(room.id)).toBe(true);
    expect(await restored.reconnectPersisted(room.id, token, "admin-new")).toHaveProperty("battle.id", room.id);
    const key = `${room.id}:0:1`;
    expect([...restored["roomVotingRosters"].get(key)!].sort()).toEqual(["admin-active", "viewer-active"]);
    expect(restored["roomVotes"].get(key)).toMatchObject([{ voterId: "viewer-active", votedForId: "mc1-active" }]);
    expect(await restored.nextPhaseDurably(room.id)).toHaveProperty("error");
    expect(await restored.submitRoomVoteDurably("admin-new", room.id, "mc1-active")).toHaveProperty("error");
  });
});
