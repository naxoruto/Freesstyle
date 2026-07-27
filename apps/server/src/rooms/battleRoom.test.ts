import { describe, expect, it } from "vitest";
import type { ScoreRubric, UserRole } from "@freestyle/shared";
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
    manager.setMode("socket-admin", { ...battle.mode, timePerTurn: 60, turnStructure: "round_trip" });
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
});
