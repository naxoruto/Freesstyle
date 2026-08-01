import { describe, expect, it } from "vitest";
import type { ScoreRubric, UserRole } from "@freestyle/shared";
import { ROLE_LIMITS } from "@freestyle/shared";
import { BattleRoomManager } from "./battleRoom";

const scores = (value: number): ScoreRubric => ({
  flow: value,
  lirica: value,
  ingenio: value,
  presencia: value,
  tecnica: value,
});

function join(
  manager: BattleRoomManager,
  battleId: string,
  socketId: string,
  userId: string,
  role: UserRole,
  adminToken?: string,
) {
  return manager.joinBattle(battleId, socketId, {
    id: userId,
    name: userId,
    alias: userId,
    role,
  }, adminToken);
}

function setupBattle() {
  const manager = new BattleRoomManager();
  const battle = manager.createBattle({ rounds: 1, timePerTurn: 1 });
  join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
  join(manager, battle.id, "socket-mc1", "mc1", "participant");
  join(manager, battle.id, "socket-mc2", "mc2", "participant");
  join(manager, battle.id, "socket-judge", "judge1", "judge");
  return { manager, battle };
}

describe("BattleRoomManager", () => {
  it("creates a lobby with merged mode defaults", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ mode: "libre", rounds: 5 });

    expect(battle.status).toBe("lobby");
    expect(battle.mode).toMatchObject({ mode: "libre", rounds: 5, timePerTurn: 60 });
  });

  it("registers participants and judges only once", () => {
    const { manager, battle } = setupBattle();
    join(manager, battle.id, "socket-mc1-copy", "mc1", "participant");
    join(manager, battle.id, "socket-judge-copy", "judge1", "judge");

    expect(battle.participants).toHaveLength(2);
    expect(battle.judges).toHaveLength(1);
  });

  it("keeps spectators separate from competitors and judges", () => {
    const { manager, battle } = setupBattle();
    join(manager, battle.id, "socket-spectator", "viewer", "spectator");

    expect(battle.spectators).toEqual([{ id: "viewer", alias: "viewer" }]);
    expect(battle.participants).toHaveLength(2);
    expect(battle.judges).toHaveLength(1);
  });

  it("rejects starting without two participants and a judge", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle();
    join(manager, battle.id, "socket-mc1", "mc1", "participant");

    join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
    expect(manager.startBattle("socket-admin")).toEqual({ error: "Se necesitan al menos 2 participantes" });

    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    expect(manager.startBattle("socket-admin")).toEqual({ error: "La mesa debe tener 1, 3 o 5 jueces" });
  });

  it("advances through the round and finishes after rubric voting", () => {
    const { manager, battle } = setupBattle();
    expect(manager.startBattle("socket-admin")).toHaveProperty("battle");

    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "mc1_turn" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "pause" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "mc2_turn" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "voting" });

    expect(manager.submitRubricVote(
      battle.id,
      "judge1",
      1,
      battle.participants[0].userId,
      battle.participants[1].userId,
      scores(8),
      scores(5),
    )).toMatchObject({ allVoted: true });

    const result = manager.nextPhase(battle.id);
    expect(result).toMatchObject({ phase: "round_result" });
    expect(battle.participants[0].roundsWon).toBe(1);

    expect(manager.nextPhase(battle.id)).toMatchObject({ battle: { status: "finished" } });
  });

  it("rejects votes from non-judges", () => {
    const { manager, battle } = setupBattle();

    expect(manager.submitRubricVote(
      battle.id,
      "mc1",
      1,
      "mc1",
      "mc2",
      scores(5),
      scores(5),
    )).toEqual({ error: "No eres juez" });
  });

  it("rejects duplicate phase transitions with a stale token", () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    const token = manager.getPhaseToken(battle.id);
    manager.nextPhase(battle.id, token);

    expect(manager.nextPhase(battle.id, token)).toEqual({ error: "Transición duplicada, ignorada" });
  });

  it("requires a valid creator token and admin role for privileged actions", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle();

    expect(join(manager, battle.id, "fake-admin", "fake", "admin", "invalid")).toBeNull();
    join(manager, battle.id, "participant", "mc1", "participant");
    expect(manager.setMode("participant", { ...battle.mode, rounds: 5 })).toBeNull();
    expect(manager.startBattle("participant")).toEqual({ error: "Solo el admin puede iniciar la batalla" });
  });

  it("lets the admin transfer control to one connected host", () => {
    const { manager, battle } = setupBattle();

    expect(manager.transferHost("socket-mc1", "judge1")).toBeNull();
    expect(manager.transferHost("socket-admin", "judge1")).toBe(battle);
    expect(battle.hostId).toBe("judge1");
    expect(manager.canControlBattle("socket-judge", battle)).toBe(true);
    expect(manager.setMode("socket-judge", { ...battle.mode, rounds: 5 })).toBeNull();
  });

  it("counts manual entries and advances when the active MC finishes", () => {
    const { manager, battle } = setupBattle();
    manager.setMode("socket-admin", { ...battle.mode, timerMode: "manual", entriesPerParticipant: 2 });
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id);

    expect(manager.completeEntry("socket-mc1")).toEqual({ error: "No tienes permiso para completar entradas" });
    expect(manager.completeEntry("socket-admin")).toMatchObject({ shouldAdvance: false });
    expect(battle.entriesRemaining[battle.currentTurn]).toBe(1);
    expect(manager.completeEntry("socket-admin")).toMatchObject({ shouldAdvance: true });
  });

  it("collects pattern votes per entry and final extras", () => {
    const { manager, battle } = setupBattle();
    manager.setMode("socket-admin", { ...battle.mode, timerMode: "manual", votingSystem: "patron", entriesPerParticipant: 2 });
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id);

    manager.completeEntry("socket-admin");
    expect(battle.roundPhase).toBe("entry_voting");
    expect(manager.submitPatronEntryVote(battle.id, "judge1", 4)).toMatchObject({ allVoted: true });
    manager.completeEntry("socket-admin");
    expect(manager.submitPatronEntryVote(battle.id, "judge1", 4)).toMatchObject({ allVoted: true });
    expect(battle.roundPhase).toBe("pause");

    manager.nextPhase(battle.id);
    manager.completeEntry("socket-admin");
    expect(manager.submitPatronEntryVote(battle.id, "judge1", 2)).toMatchObject({ allVoted: true });
    manager.completeEntry("socket-admin");
    expect(manager.submitPatronEntryVote(battle.id, "judge1", 2)).toMatchObject({ allVoted: true });
    expect(battle.roundPhase).toBe("voting");

    expect(manager.submitPatronExtraVote(battle.id, "judge1", 3, 1)).toMatchObject({ allVoted: true });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "round_result" });
    expect(battle.roundResults).toHaveLength(1);
  });

  it("runs two complete turns per MC for ida y vuelta", () => {
    const { manager, battle } = setupBattle();
    manager.setMode("socket-admin", { ...battle.mode, timePerTurn: 60, turnStructure: "round_trip", firstTurnParticipantId: "mc1" });
    manager.startBattle("socket-admin");

    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "mc1_turn", participantId: "mc1" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "pause" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "mc2_turn", participantId: "mc2" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "pause" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "mc2_turn", participantId: "mc2" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "pause" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "mc1_turn", participantId: "mc1" });
    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "voting" });
  });

  it("allows only judge tables of 1, 3 or 5 and rejects a sixth judge", () => {
    const { manager, battle } = setupBattle();
    join(manager, battle.id, "socket-judge2", "judge2", "judge");
    expect(manager.startBattle("socket-admin")).toEqual({ error: "La mesa debe tener 1, 3 o 5 jueces" });
    join(manager, battle.id, "socket-judge3", "judge3", "judge");
    expect(manager.startBattle("socket-admin")).toHaveProperty("battle");

    const secondManager = new BattleRoomManager();
    const secondBattle = secondManager.createBattle();
    for (let index = 1; index <= 5; index++) join(secondManager, secondBattle.id, `socket-j${index}`, `judge${index}`, "judge");
    expect(join(secondManager, secondBattle.id, "socket-j6", "judge6", "judge")).toBeNull();
    expect(secondBattle.judges).toHaveLength(5);
  });

  it("starts a configured replica when accumulated scores are tied", () => {
    const { manager, battle } = setupBattle();
    manager.setReplicaConfig("socket-admin", {
      enabled: true,
      maxReplicas: 1,
      tieRange: 0,
      mode: { ...battle.mode, rounds: 1 },
    });
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    manager.submitRubricVote(
      battle.id,
      "judge1",
      1,
      battle.participants[0].userId,
      battle.participants[1].userId,
      scores(5),
      scores(5),
    );
    manager.nextPhase(battle.id);

    expect(manager.nextPhase(battle.id)).toMatchObject({ phase: "countdown", battle: { status: "replica", replicaCount: 1 } });
  });

  it("rejects a third participant beyond the limit", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle();
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");

    const joinResult = join(manager, battle.id, "socket-mc3", "mc3", "participant");
    expect(joinResult).toBeNull();
    expect(battle.participants.length).toBe(ROLE_LIMITS.participant);
  });

  it("allows up to the admin limit and rejects the next", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle();
    const token = manager.getAdminToken(battle.id);

    join(manager, battle.id, "socket-admin1", "admin1", "admin", token);
    expect(join(manager, battle.id, "socket-admin2", "admin2", "admin", token)).not.toBeNull();
    expect(join(manager, battle.id, "socket-admin3", "admin3", "admin", token)).toBeNull();
  });

  it("rejects a sixth judge beyond the limit", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle();
    for (let index = 1; index <= ROLE_LIMITS.judge; index++) {
      join(manager, battle.id, `socket-j${index}`, `judge${index}`, "judge");
    }
    expect(join(manager, battle.id, "socket-j6", "judge6", "judge")).toBeNull();
    expect(battle.judges.length).toBe(ROLE_LIMITS.judge);
  });

  it("rejects duplicate host", () => {
    const { manager, battle } = setupBattle();
    join(manager, battle.id, "socket-host1", "host1", "host");
    expect(join(manager, battle.id, "socket-host2", "host2", "host")).toBeNull();
  });

  it("preserves participant identity on disconnect and allows reconnect within window", () => {
    const { manager, battle } = setupBattle();
    const socketId = "socket-mc1";

    const sessionId = manager.getSessionId(socketId);
    expect(sessionId).toBeDefined();
    expect(battle.participants).toHaveLength(2);

    const result = manager.handleDisconnect(socketId);
    expect(result).not.toBeNull();
    expect(result!.battleId).toBe(battle.id);

    expect(battle.participants).toHaveLength(2);

    const reconnectResult = manager.reconnect(battle.id, sessionId!, "socket-mc1-new");
    expect("error" in reconnectResult).toBe(false);
    if (!("error" in reconnectResult)) {
      expect(reconnectResult.battle.participants).toHaveLength(2);
      expect(manager.getSessionId("socket-mc1-new")).toBe(sessionId);
      expect(manager.getSocketIdentity("socket-mc1-new", "participant")?.userId).toBe("mc1");
    }
  });

  it("removes participant on explicit leaveRoom", () => {
    const { manager, battle } = setupBattle();
    expect(battle.participants).toHaveLength(2);

    const room = manager.leaveRoom("socket-mc1");
    expect(room).not.toBeNull();
    expect(battle.participants).toHaveLength(1);
    expect(battle.participants[0].userId).toBe("mc2");
  });

  it("rejects reconnect with invalid session id", () => {
    const { manager, battle } = setupBattle();
    const result = manager.reconnect(battle.id, "invalid-session", "socket-new");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toBe("Sesión no encontrada");
  });

  it("rejects reconnect when session already connected", () => {
    const { manager, battle } = setupBattle();
    const sessionId = manager.getSessionId("socket-mc1");
    const result = manager.reconnect(battle.id, sessionId!, "socket-mc1-copy");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toBe("La sesión ya está conectada");
  });

  it("creates and consumes a valid invitation", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });
    const adminToken = manager.getAdminToken(battle.id)!;
    join(manager, battle.id, "socket-admin", "admin1", "admin", adminToken);

    const inviteToken = manager.createInvitation(battle.id, "participant", adminToken);
    expect(inviteToken).toBeTruthy();

    const result = manager.consumeInvitation(inviteToken!);
    expect(result).not.toBeNull();
    expect(result!.roomId).toBe(battle.id);
    expect(result!.role).toBe("participant");
  });

  it("rejects invitation creation with invalid adminToken", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });

    const inviteToken = manager.createInvitation(battle.id, "participant", "wrong-token");
    expect(inviteToken).toBeNull();
  });

  it("rejects invitation for unsupported roles", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });
    const adminToken = manager.getAdminToken(battle.id)!;

    const inviteToken = manager.createInvitation(battle.id, "admin", adminToken);
    expect(inviteToken).toBeNull();
  });

  it("rejects consumed/expired invitations", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });
    const adminToken = manager.getAdminToken(battle.id)!;

    const inviteToken = manager.createInvitation(battle.id, "participant", adminToken)!;
    expect(manager.consumeInvitation(inviteToken)).not.toBeNull();
    expect(manager.consumeInvitation(inviteToken)).toBeNull();
  });

  it("rejects invalid invitation token", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });

    expect(manager.consumeInvitation("invalid-token")).toBeNull();
  });

  it("rejects admin access without valid token", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });

    const result = join(manager, battle.id, "socket-fake", "fake", "admin", "wrong-token");
    expect(result).toBeNull();

    const resultNoToken = join(manager, battle.id, "socket-fake2", "fake2", "admin");
    expect(resultNoToken).toBeNull();
  });

  it("allows non-admin participants to join without token", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });

    const result = join(manager, battle.id, "socket-mc1", "mc1", "participant");
    expect(result).not.toBeNull();
    expect(battle.participants).toHaveLength(1);
  });

  it("allows spectators to join without token", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });

    const result = join(manager, battle.id, "socket-spec", "spec1", "spectator");
    expect(result).not.toBeNull();
    expect(battle.spectators).toHaveLength(1);
  });

  it("prevents unauthorized admin from starting battle", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-judge", "judge1", "judge");

    expect(manager.startBattle("socket-mc1")).toEqual({ error: "Solo el admin puede iniciar la batalla" });
    expect(manager.startBattle("socket-judge")).toEqual({ error: "Solo el admin puede iniciar la batalla" });
  });

  it("allows admin to change a participant to judge", () => {
    const { manager, battle } = setupBattle();
    expect(battle.participants).toHaveLength(2);
    expect(battle.judges).toHaveLength(1);

    const result = manager.changeRole("socket-admin", "mc1", "judge");
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.participants).toHaveLength(1);
      expect(result.judges).toHaveLength(2);
    }
  });

  it("lets an admin change operational role without losing admin permissions", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });
    join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-admin", "admin1", "judge");
    join(manager, battle.id, "socket-mc1", "mc1", "participant");

    const result = manager.changeRole("socket-admin", "admin1", "participant");
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.participants.some(participant => participant.userId === "admin1")).toBe(true);
      expect(result.judges.some(judge => judge.id === "admin1")).toBe(false);
      expect(manager.startBattle("socket-admin")).toEqual({ error: "La mesa debe tener 1, 3 o 5 jueces" });
    }
  });

  it("rejects role change from non-admin", () => {
    const { manager, battle } = setupBattle();
    const result = manager.changeRole("socket-mc1", "judge1", "participant");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toBe("Solo el admin puede cambiar roles");
  });

  it("rejects role change when limit would be exceeded", () => {
    const { manager, battle } = setupBattle();
    join(manager, battle.id, "socket-j2", "judge2", "judge");
    join(manager, battle.id, "socket-j3", "judge3", "judge");
    join(manager, battle.id, "socket-j4", "judge4", "judge");
    join(manager, battle.id, "socket-j5", "judge5", "judge");

    expect(battle.judges).toHaveLength(5);
    const result = manager.changeRole("socket-admin", "mc1", "judge");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toBe("El límite de judge ya fue alcanzado");
  });

  it("rejects role change outside lobby", () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");

    const result = manager.changeRole("socket-admin", "mc1", "judge");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toBe("Solo se pueden cambiar roles en el lobby");
  });

  it("rejects role change for user not in battle", () => {
    const { manager, battle } = setupBattle();
    const result = manager.changeRole("socket-admin", "nonexistent", "participant");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toBe("Usuario no encontrado en esta sala");
  });

  it("rejects manual mode without live control enabled", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });
    join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-judge", "judge1", "judge");
    manager.setMode("socket-admin", { ...battle.mode, timerMode: "manual", liveControlEnabled: false, entriesPerParticipant: 2 });

    expect(manager.startBattle("socket-admin")).toEqual({ error: "El modo por entradas requiere control en vivo activado." });
  });

  it("completes a full 4x4 battle with manual entries", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ format: "4x4", rounds: 1, liveControlEnabled: true });
    join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-judge", "judge1", "judge");

    expect(battle.mode.format).toBe("4x4");
    expect(battle.mode.entriesPerParticipant).toBe(4);
    expect(battle.mode.timerMode).toBe("manual");

    expect(manager.startBattle("socket-admin")).toHaveProperty("battle");

    // Round starts with countdown → mc1_turn
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "mc1_turn" });

    // mc1 does 4 entries
    for (let i = 0; i < 4; i++) {
      expect(manager.completeEntry("socket-admin")).toMatchObject({ shouldAdvance: i === 3 });
    }
    // After mc1's last entry, auto-advance to pause
    const afterMc1 = manager.nextPhase(battle.id, undefined, true);
    expect(afterMc1).toMatchObject({ phase: "pause" });

    // After pause, advance to mc2_turn
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "mc2_turn" });

    // mc2 does 4 entries
    for (let i = 0; i < 4; i++) {
      expect(manager.completeEntry("socket-admin")).toMatchObject({ shouldAdvance: i === 3 });
    }
    // After mc2's last entry
    const afterMc2 = manager.nextPhase(battle.id, undefined, true);
    expect(afterMc2).toMatchObject({ phase: "voting" });

    // Judge votes → round result
    const mc1 = battle.participants[0];
    const mc2 = battle.participants[1];
    manager.submitRubricVote(battle.id, "judge1", 1, mc1.userId, mc2.userId, scores(8), scores(5));
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "round_result" });
    expect(battle.participants[0].roundsWon).toBe(1);

    // Finished
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ battle: { status: "finished" } });
  });

  it("completes a full 1x1 countdown battle", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ format: "1x1", rounds: 1, firstTurnParticipantId: "mc1" });
    join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-judge", "judge1", "judge");

    expect(battle.mode.format).toBe("1x1");
    expect(battle.mode.timerMode).toBe("countdown");
    expect(battle.mode.entriesPerParticipant).toBe(1);

    manager.startBattle("socket-admin");

    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "mc1_turn" });
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "pause" });
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "mc2_turn" });
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "voting" });

    const p1 = battle.participants[0];
    const p2 = battle.participants[1];
    manager.submitRubricVote(battle.id, "judge1", 1, p1.userId, p2.userId, scores(7), scores(5));
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "round_result" });
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ battle: { status: "finished" } });
  });

  it("completes a round with free vote system", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ format: "1x1", rounds: 1, votingSystem: "free_vote" });
    join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-judge1", "judge1", "judge");
    join(manager, battle.id, "socket-judge2", "judge2", "judge");
    join(manager, battle.id, "socket-judge3", "judge3", "judge");

    expect(battle.mode.votingSystem).toBe("free_vote");

    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "voting" });

    // Judge 1 votes for mc1
    expect(manager.submitFreeVote(battle.id, "judge1", "mc1")).toMatchObject({ allVoted: false });
    // Judge 2 votes for mc1
    expect(manager.submitFreeVote(battle.id, "judge2", "mc1")).toMatchObject({ allVoted: false });
    // Judge 3 votes for mc2
    expect(manager.submitFreeVote(battle.id, "judge3", "mc2")).toMatchObject({ allVoted: true });

    // Advance → round_result (mc1 wins 2-1)
    const result = manager.nextPhase(battle.id, undefined, true);
    expect(result).toMatchObject({ phase: "round_result" });
    if (!("error" in result) && result.scores) {
      const winnerId = Object.entries(result.scores).sort(([, a], [, b]) => b - a)[0]?.[0];
      const winner = battle.participants.find(p => p.userId === winnerId);
      expect(winner?.roundsWon).toBe(1);
    }

    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ battle: { status: "finished" } });
  });

  it("rejects free vote when voting system is not free_vote", () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);

    expect(manager.submitFreeVote(battle.id, "judge1", "mc1")).toEqual({ error: "No corresponde votar con voto libre" });
  });

  it("rejects free vote for invalid participant", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ format: "1x1", rounds: 1, votingSystem: "free_vote" });
    join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-judge", "judge1", "judge");

    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);

    expect(manager.submitFreeVote(battle.id, "judge1", "invalid")).toEqual({ error: "El voto debe ser para uno de los participantes" });
  });

  it("finishes battle when max replicas are exhausted", () => {
    const { manager, battle } = setupBattle();
    manager.setMode("socket-admin", { ...battle.mode, rounds: 1, firstTurnParticipantId: battle.participants[0].userId });
    manager.setReplicaConfig("socket-admin", {
      enabled: true,
      maxReplicas: 1,
      tieRange: 100,
      mode: { ...battle.mode, rounds: 1 },
    });
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.submitRubricVote(battle.id, "judge1", 1, battle.participants[0].userId, battle.participants[1].userId, scores(5), scores(5));
    manager.nextPhase(battle.id, undefined, true);

    // First replica starts
    expect(manager.nextPhase(battle.id, undefined, true)).toMatchObject({ phase: "countdown", battle: { status: "replica", replicaCount: 1 } });

    // Play through the replica
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    const p1 = battle.participants[0];
    const p2 = battle.participants[1];
    manager.submitRubricVote(battle.id, "judge1", 1, p1.userId, p2.userId, scores(5), scores(5));
    manager.nextPhase(battle.id, undefined, true);

    // No more replicas allowed — battle finishes
    const result = manager.nextPhase(battle.id, undefined, true);
    expect("error" in result ? false : true).toBe(true);
    if (!("error" in result)) {
      expect(result.battle.status).toBe("finished");
      expect(result.battle.replicaCount).toBe(1);
    }
  });

  it("does not start replica when score difference exceeds tie range", () => {
    const { manager, battle } = setupBattle();
    manager.setMode("socket-admin", { ...battle.mode, rounds: 1, firstTurnParticipantId: battle.participants[0].userId });
    manager.setReplicaConfig("socket-admin", {
      enabled: true,
      maxReplicas: 3,
      tieRange: 2,
      mode: { ...battle.mode, rounds: 1 },
    });
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    // mc1 scores 8, mc2 scores 5 → diff = 3 > 2, no replica
    manager.submitRubricVote(battle.id, "judge1", 1, battle.participants[0].userId, battle.participants[1].userId, scores(8), scores(5));
    manager.nextPhase(battle.id, undefined, true);

    const result = manager.nextPhase(battle.id, undefined, true);
    expect("error" in result ? false : true).toBe(true);
    if (!("error" in result)) {
      expect(result.battle.status).toBe("finished");
    }
  });

  it("runs multiple replicas until a clear winner emerges", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1, firstTurnParticipantId: "mc1" });
    join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-judge", "judge1", "judge");

    manager.setReplicaConfig("socket-admin", {
      enabled: true,
      maxReplicas: 3,
      tieRange: 5,
      mode: { ...battle.mode, rounds: 1 },
    });
    manager.startBattle("socket-admin");

    // First battle — tie (5-5)
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.submitRubricVote(battle.id, "judge1", 1, "mc1", "mc2", scores(5), scores(5));
    manager.nextPhase(battle.id, undefined, true);
    // Replica starts
    const replicaStart = manager.nextPhase(battle.id, undefined, true);
    expect(replicaStart).toMatchObject({ phase: "countdown", battle: { replicaCount: 1 } });

    // Replica — clear winner (8 vs 5)
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.nextPhase(battle.id, undefined, true);
    manager.submitRubricVote(battle.id, "judge1", 1, "mc1", "mc2", scores(8), scores(5));
    manager.nextPhase(battle.id, undefined, true);
    // Should finish since diff > tieRange
    const result = manager.nextPhase(battle.id, undefined, true);
    if (!("error" in result)) {
      expect(result.battle.status).toBe("finished");
    }
  });
});
