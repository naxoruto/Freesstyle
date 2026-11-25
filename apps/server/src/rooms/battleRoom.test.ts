import { describe, expect, it, vi } from "vitest";
import type { ScoreRubric, UserRole } from "@freestyle/shared";
import { ROLE_LIMITS } from "@freestyle/shared";
import { BattleRoomManager } from "./battleRoom";
import type { BattlePersistence } from "./battlePersistence";

vi.mock("./battlePersistence", () => ({
  BattlePersistence: class {
    create = vi.fn().mockResolvedValue(undefined);
    update = vi.fn().mockResolvedValue(undefined);
    addParticipant = vi.fn().mockResolvedValue(undefined);
    removeParticipant = vi.fn().mockResolvedValue(undefined);
    addJudge = vi.fn().mockResolvedValue(undefined);
    removeJudge = vi.fn().mockResolvedValue(undefined);
    addSpectator = vi.fn().mockResolvedValue(undefined);
    removeSpectator = vi.fn().mockResolvedValue(undefined);
    saveRubricVote = vi.fn().mockResolvedValue(undefined);
    savePatronEntryVote = vi.fn().mockResolvedValue(undefined);
    commitPatronEntryVote = vi.fn().mockResolvedValue(undefined);
    commitRoomVotingRoster = vi.fn().mockResolvedValue(undefined);
    saveFreeVote = vi.fn().mockResolvedValue(undefined);
    saveRoomVote = vi.fn().mockResolvedValue(undefined);
    savePatronExtraVote = vi.fn().mockResolvedValue(undefined);
    saveRoundResult = vi.fn().mockResolvedValue(undefined);
    commitBattleAndResult = vi.fn().mockResolvedValue(undefined);
    loadActiveBattles = vi.fn().mockResolvedValue([]);
    saveSession = vi.fn().mockResolvedValue(undefined);
    deleteSession = vi.fn().mockResolvedValue(undefined);
    commitMemberRoles = vi.fn().mockResolvedValue(undefined);
    commitBattleStart = vi.fn().mockResolvedValue(undefined);
    findSession = vi.fn().mockResolvedValue(null);
    listSessionMembers = vi.fn().mockResolvedValue([]);
  },
}));

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

describe("BattleRoomManager — persistencia y bloqueo ante fallos", () => {
  it("notifica el fallo de una escritura en lugar de silenciarlo", async () => {
    const persistence = {
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockRejectedValue(new Error("fallo simulado")),
    } as unknown as BattlePersistence;
    const manager = new BattleRoomManager(persistence);
    const onFailure = vi.fn();
    manager.onPersistenceFailure = onFailure;

    const battle = manager.createBattle({ rounds: 1, timePerTurn: 1 });
    manager.joinBattle(battle.id, "socket-admin", { id: "admin1", name: "admin1", alias: "admin1", role: "admin" }, manager.getAdminToken(battle.id));
    manager.setMode("socket-admin", { ...battle.mode, rounds: 2 });

    await vi.waitFor(() => {
      expect(onFailure).toHaveBeenCalledWith(battle.id);
    });
  });
});

describe("BattleRoomManager", () => {
  it("resumes a recovered phase only after authorization, a time decision and a durable save", async () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    manager["recoveryPaused"].add(battle.id);
    battle.phaseDeadline = new Date(Date.now() - 1000).toISOString();
    expect(await manager.resumeBattleDurably("socket-judge", "restart_clock")).toHaveProperty("error");
    expect(await manager.resumeBattleDurably("socket-admin", "continue")).toHaveProperty("error");
    const mc = battle.members.find(member => member.userId === "mc1")!;
    mc.connected = false;
    expect(await manager.resumeBattleDurably("socket-admin", "restart_clock")).toHaveProperty("error");
    mc.connected = true;
    const oldToken = battle.phaseToken;
    let release!: () => void;
    vi.spyOn(manager["persistence"], "update").mockReturnValue(new Promise(resolve => { release = () => resolve(battle); }));
    const pending = manager.resumeBattleDurably("socket-admin", "restart_clock");
    expect(manager.isRecoveryPaused(battle.id)).toBe(true);
    release();
    expect(await pending).toHaveProperty("battle.id", battle.id);
    expect(manager.isRecoveryPaused(battle.id)).toBe(false);
    expect(battle.phaseToken).not.toBe(oldToken);
    expect(manager.getPhaseTiming(battle.id)).toMatchObject({ state: "pending", timeRemaining: 4 });
    expect(await manager.resumeBattleDurably("socket-admin", "restart_clock")).toHaveProperty("error");
  });

  it("keeps a recovered battle paused if resumption cannot be saved", async () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    manager["recoveryPaused"].add(battle.id);
    const oldToken = battle.phaseToken;
    vi.spyOn(manager["persistence"], "update").mockRejectedValue(new Error("storage failure"));
    await expect(manager.resumeBattleDurably("socket-admin", "continue")).rejects.toThrow("storage failure");
    expect(manager.isRecoveryPaused(battle.id)).toBe(true);
    expect(battle.phaseToken).toBe(oldToken);
  });

  it("refuses to resume incomplete historical state or a missing room roster", async () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    manager["recoveryPaused"].add(battle.id);
    const token = battle.phaseToken;
    battle.phaseToken = undefined;
    expect(await manager.resumeBattleDurably("socket-admin", "restart_clock")).toHaveProperty("error");
    battle.phaseToken = token;
    battle.mode.votingSystem = "room_vote";
    battle.roundPhase = "voting";
    expect(await manager.resumeBattleDurably("socket-admin", "continue")).toHaveProperty("error");
    expect(manager.isRecoveryPaused(battle.id)).toBe(true);
  });
  it("sets phase deadlines before persisting and preserves them on rejected advances", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-22T10:00:00Z"));
      const { manager, battle } = setupBattle();
      manager.startBattle("socket-admin");
      expect(battle.phaseDeadline).toBe("2026-11-22T10:00:04.000Z");
      expect(battle.phaseToken).toBe(manager.getPhaseToken(battle.id));
      manager.nextPhase(battle.id);
      expect(battle.phaseDeadline).toBe("2026-11-22T10:01:00.000Z");
      const token = battle.phaseToken;
      const deadline = battle.phaseDeadline;
      expect(manager.nextPhase(battle.id, "stale-token")).toHaveProperty("error");
      expect(battle.phaseToken).toBe(token);
      expect(battle.phaseDeadline).toBe(deadline);
      manager.nextPhase(battle.id);
      manager.nextPhase(battle.id);
      manager.nextPhase(battle.id);
      expect(battle.roundPhase).toBe("voting");
      expect(battle.phaseDeadline).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });

  it("schedules from the saved deadline instead of restarting the full duration", () => {
    vi.useFakeTimers();
    try {
      const { manager, battle } = setupBattle();
      manager.startBattle("socket-admin");
      vi.advanceTimersByTime(2500);
      const callback = vi.fn();
      manager.setPhaseTimer(battle.id, 4000, callback);
      vi.advanceTimersByTime(1499);
      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });

  it("leaves manual turns and entry voting untimed and gives patron pauses a fresh deadline", () => {
    const { manager, battle } = setupBattle();
    manager.setMode("socket-admin", { ...battle.mode, timerMode: "manual", votingSystem: "patron", entriesPerParticipant: 2 });
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id);
    expect(manager.getPhaseTiming(battle.id)).toEqual({ state: "untimed" });
    const firstToken = battle.phaseToken;
    manager.completeEntry("socket-admin");
    expect(battle.phaseToken).not.toBe(firstToken);
    expect(battle.phaseDeadline).toBeUndefined();
    manager.submitPatronEntryVote(battle.id, "judge1", 3);
    expect(manager.getPhaseTiming(battle.id)).toEqual({ state: "untimed" });
    manager.completeEntry("socket-admin");
    manager.submitPatronEntryVote(battle.id, "judge1", 3);
    expect(battle.roundPhase).toBe("pause");
    expect(manager.getPhaseTiming(battle.id)).toMatchObject({ state: "pending", timeRemaining: 4 });
  });
  it("only confirms durable creation after the database write succeeds", async () => {
    const manager = new BattleRoomManager();
    let release!: () => void;
    const write = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(manager["persistence"], "create").mockReturnValue(write as never);
    let completed = false;
    const creation = manager.createBattleDurably().then(battle => { completed = true; return battle; });
    await Promise.resolve();
    expect(completed).toBe(false);
    release();
    const battle = await creation;
    expect(manager.listBattles()).toContain(battle);
    expect(manager.getAdminToken(battle.id)).toBeTruthy();
  });

  it("removes the in-memory room and credential when durable creation fails", async () => {
    const manager = new BattleRoomManager();
    vi.spyOn(manager["persistence"], "create").mockRejectedValue(new Error("database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(manager.createBattleDurably()).rejects.toThrow("database unavailable");
      expect(manager.listBattles()).toHaveLength(0);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

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

  it("waits for a durable battle start and rejects storage errors", async () => {
    const { manager, battle } = setupBattle();
    let release!: () => void;
    const write = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(manager["persistence"], "commitBattleStart").mockReturnValue(write as never);
    let completed = false;
    const pending = manager.startBattleDurably("socket-admin").then(result => { completed = true; return result; });
    await Promise.resolve();
    expect(completed).toBe(false);
    release();
    expect(await pending).toMatchObject({ battle: { id: battle.id, status: "in_progress" } });
    const another = setupBattle();
    vi.spyOn(another.manager["persistence"], "commitBattleStart").mockRejectedValue(new Error("database unavailable"));
    await expect(another.manager.startBattleDurably("socket-admin")).rejects.toThrow("database unavailable");
  });

  it("waits for a rubric vote to be saved and propagates storage errors", async () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    for (let i = 0; i < 4; i++) manager.nextPhase(battle.id);
    let release!: () => void;
    const write = new Promise<void>(resolve => { release = resolve; });
    const save = vi.spyOn(manager["persistence"], "saveRubricVote").mockReturnValue(write as never);
    let completed = false;
    const args = [battle.id, "judge1", 1, battle.participants[0].userId, battle.participants[1].userId, scores(8), scores(5)] as const;
    const pending = manager.submitRubricVoteDurably(...args).then(result => { completed = true; return result; });
    await Promise.resolve();
    expect(completed).toBe(false);
    release();
    expect(await pending).toMatchObject({ allVoted: true });
    save.mockRejectedValue(new Error("database unavailable"));
    await expect(manager.submitRubricVoteDurably(...args)).rejects.toThrow("database unavailable");
  });

  it("waits for a patron entry vote and resulting phase to be committed", async () => {
    const { manager, battle } = setupBattle();
    manager.setMode("socket-admin", { ...battle.mode, timerMode: "manual", votingSystem: "patron", entriesPerParticipant: 2 });
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id);
    manager.completeEntry("socket-admin");
    let release!: () => void;
    const write = new Promise<void>(resolve => { release = resolve; });
    const commit = vi.spyOn(manager["persistence"], "commitPatronEntryVote").mockReturnValue(write as never);
    let completed = false;
    const pending = manager.submitPatronEntryVoteDurably(battle.id, "judge1", 4).then(result => { completed = true; return result; });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ pendingEntry: undefined }), expect.objectContaining({ judgeId: "judge1", points: 4 }));
    release();
    expect(await pending).toMatchObject({ allVoted: true });
  });

  it("does not confirm an entry completion before it is saved", async () => {
    const { manager, battle } = setupBattle();
    manager.setMode("socket-admin", { ...battle.mode, timerMode: "manual", votingSystem: "patron", entriesPerParticipant: 2 });
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id);
    let release!: () => void;
    const write = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(manager["persistence"], "update").mockReturnValue(write as never);
    let completed = false;
    const pending = manager.completeEntryDurably("socket-admin").then(result => { completed = true; return result; });
    await Promise.resolve();
    expect(completed).toBe(false);
    release();
    expect(await pending).toMatchObject({ battle: { roundPhase: "entry_voting" } });
  });

  it("propagates a patron extra vote storage failure", async () => {
    const { manager, battle } = setupBattle();
    manager.setMode("socket-admin", { ...battle.mode, timerMode: "manual", votingSystem: "patron", entriesPerParticipant: 2 });
    manager.startBattle("socket-admin");
    battle.roundPhase = "voting";
    vi.spyOn(manager["persistence"], "savePatronExtraVote").mockRejectedValue(new Error("database unavailable"));
    await expect(manager.submitPatronExtraVoteDurably(battle.id, "judge1", 3, 1)).rejects.toThrow("database unavailable");
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

  it("genera palabra solo en las rondas con concepto en modo variado (L→C→L)", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ mode: "variado", rounds: 3, timePerTurn: 60 });
    join(manager, battle.id, "socket-admin", "admin1", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-judge", "judge1", "judge");
    manager.startBattle("socket-admin");

    // Ronda 1 (libre): sin palabra
    const r1 = manager.nextPhase(battle.id);
    expect(r1).toMatchObject({ phase: "mc1_turn" });
    expect(battle.currentWord).toBeUndefined();

    // Cerrar ronda 1
    manager.nextPhase(battle.id); // mc1_turn → pause
    manager.nextPhase(battle.id); // pause → mc2_turn
    manager.nextPhase(battle.id); // mc2_turn → voting
    manager.submitRubricVote(battle.id, "judge1", 1, battle.participants[0].userId, battle.participants[1].userId, scores(8), scores(5));
    manager.nextPhase(battle.id); // voting → round_result
    manager.nextPhase(battle.id); // round_result → countdown (ronda 2)

    // Ronda 2 (concepto): con palabra
    const r2 = manager.nextPhase(battle.id);
    expect(r2).toMatchObject({ phase: "mc1_turn" });
    expect(battle.currentWord).toBeDefined();
  });

  it("persists a resolved round and its final battle state in one operation", () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    for (let i = 0; i < 4; i++) manager.nextPhase(battle.id);
    manager.submitRubricVote(battle.id, "judge1", 1, battle.participants[0].userId, battle.participants[1].userId, scores(8), scores(5));
    const commit = vi.spyOn(manager["persistence"], "commitBattleAndResult");
    manager.nextPhase(battle.id);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ roundPhase: "round_result" }), expect.objectContaining({ round: 1, replica: 0 }));
  });

  it("waits for the phase write before confirming a durable transition", async () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    let release!: () => void;
    const write = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(manager["persistence"], "update").mockReturnValue(write as never);
    let completed = false;
    const pending = manager.nextPhaseDurably(battle.id).then(result => { completed = true; return result; });
    await Promise.resolve();
    expect(completed).toBe(false);
    release();
    expect(await pending).toMatchObject({ phase: "mc1_turn" });
  });

  it("rejects a durable transition if persistence fails", async () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    vi.spyOn(manager["persistence"], "update").mockRejectedValue(new Error("database unavailable"));
    await expect(manager.nextPhaseDurably(battle.id)).rejects.toThrow("database unavailable");
  });

  it("does not confirm a round result when its transaction fails", async () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    for (let i = 0; i < 4; i++) manager.nextPhase(battle.id);
    manager.submitRubricVote(battle.id, "judge1", 1, battle.participants[0].userId, battle.participants[1].userId, scores(8), scores(5));
    vi.spyOn(manager["persistence"], "commitBattleAndResult").mockRejectedValue(new Error("transaction failed"));
    await expect(manager.nextPhaseDurably(battle.id)).rejects.toThrow("transaction failed");
  });

  it("persists each successful phase transition", () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    const update = vi.spyOn(manager["persistence"], "update");
    update.mockClear();

    const phase = manager.nextPhase(battle.id);
    expect(phase).toHaveProperty("phase", battle.roundPhase);
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0].roundPhase).toBe(battle.roundPhase);
  });

  it("persists lobby configuration changes", () => {
    const { manager, battle } = setupBattle();
    const update = vi.spyOn(manager["persistence"], "update");
    update.mockClear();
    expect(manager.setMode("socket-admin", { ...battle.mode, rounds: 2 })).toBe(battle);
    expect(update).toHaveBeenCalledTimes(1);
    update.mockClear();
    expect(manager.setReplicaConfig("socket-admin", { enabled: true, maxReplicas: 1, tieRange: 0, mode: { ...battle.mode } })).toBe(battle);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("does not grant admin access to a restored room without a valid admin token", async () => {
    const previous = new BattleRoomManager().createBattle();
    const manager = new BattleRoomManager();
    vi.spyOn(manager["persistence"], "loadActiveBattles").mockResolvedValue([previous]);
    await manager.loadActiveBattlesFromDb();

    expect(manager.getJoinError(previous.id, { id: "stranger", alias: "Stranger", role: "admin" })).toBe("Acceso de admin inválido");
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

  it("does not authorize a judge's socket to vote in a different room", () => {
    const { manager, battle } = setupBattle();
    const other = manager.createBattle();
    expect(manager.getSocketIdentityForBattle("socket-judge", "judge", battle.id)?.userId).toBe("judge1");
    expect(manager.getSocketIdentityForBattle("socket-judge", "judge", other.id)).toBeUndefined();
    expect(manager.getSocketIdentityForBattle("socket-judge", "judge", "")).toBeUndefined();
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

  it("assigns a waiting member as host and preserves a judge role", () => {
    const { manager, battle } = setupBattle();
    manager.joinBattle(battle.id, "socket-guest", { id: "guest", name: "Guest", alias: "Guest" });

    expect(manager.transferHost("socket-admin", "guest")).toBe(battle);
    expect(battle.members.find(member => member.userId === "guest")?.roles).toEqual(["host"]);
    expect(manager.changeRole("socket-admin", "guest", "judge")).toBe(battle);
    expect(battle.members.find(member => member.userId === "guest")?.roles).toEqual(expect.arrayContaining(["host", "judge"]));
    expect(manager.canControlBattle("socket-guest", battle)).toBe(true);
  });

  it("removes host control from the previous host when transferring", () => {
    const { manager, battle } = setupBattle();
    manager.joinBattle(battle.id, "socket-guest", { id: "guest", name: "Guest", alias: "Guest" });

    expect(manager.transferHost("socket-admin", "mc1")).toBe(battle);
    expect(manager.transferHost("socket-admin", "guest")).toBe(battle);
    expect(battle.members.find(member => member.userId === "mc1")?.roles).not.toContain("host");
    expect(manager.canControlBattle("socket-mc1", battle)).toBe(false);
    expect(manager.canControlBattle("socket-guest", battle)).toBe(true);
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

  it("does not reuse the original round's rubric vote in a replica", () => {
    const { manager, battle } = setupBattle();
    manager.setReplicaConfig("socket-admin", { enabled: true, maxReplicas: 1, tieRange: 0, mode: { ...battle.mode, rounds: 1 } });
    manager.startBattle("socket-admin");
    for (let i = 0; i < 4; i++) manager.nextPhase(battle.id);
    manager.submitRubricVote(battle.id, "judge1", 1, battle.participants[0].userId, battle.participants[1].userId, scores(5), scores(5));
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    for (let i = 0; i < 4; i++) manager.nextPhase(battle.id);
    expect(battle.roundPhase).toBe("voting");
    expect(manager.nextPhase(battle.id)).toHaveProperty("error", "Esperando votos de los jueces...");
  });

  it("keeps the phase token valid when the server is still waiting for votes", () => {
    const { manager, battle } = setupBattle();
    manager.startBattle("socket-admin");
    for (let i = 0; i < 4; i++) manager.nextPhase(battle.id);
    const token = manager.getPhaseToken(battle.id)!;
    expect(manager.nextPhase(battle.id, token)).toHaveProperty("error", "Esperando votos de los jueces...");
    expect(manager.getPhaseToken(battle.id)).toBe(token);
    manager.submitRubricVote(battle.id, "judge1", 1, battle.participants[0].userId, battle.participants[1].userId, scores(8), scores(5));
    expect(manager.nextPhase(battle.id, token)).toHaveProperty("phase", "round_result");
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

  it("uses the creator token only for the initial admin", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle();
    const token = manager.getAdminToken(battle.id);

    join(manager, battle.id, "socket-admin1", "admin1", "admin", token);
    expect(join(manager, battle.id, "socket-admin2", "admin2", "admin", token)).toBeNull();
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

  it("keeps competitors and judges in an active battle during extended disconnects", () => {
    vi.useFakeTimers();
    try {
      const { manager, battle } = setupBattle();
      manager.startBattle("socket-admin");
      const token = manager.getSessionId("socket-mc1")!;
      manager.handleDisconnect("socket-mc1");
      manager.handleDisconnect("socket-judge");
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      expect(battle.participants.map(participant => participant.userId)).toContain("mc1");
      expect(battle.judges.map(judge => judge.id)).toContain("judge1");
      expect(manager["persistence"].removeParticipant).not.toHaveBeenCalled();
      expect(manager["persistence"].removeJudge).not.toHaveBeenCalled();
      expect(manager.reconnect(battle.id, token, "socket-mc1-return")).toHaveProperty("battle.id", battle.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates a high-entropy session token for each connected member", () => {
    const { manager } = setupBattle();
    const first = manager.getSessionId("socket-admin");
    const second = manager.getSessionId("socket-mc1");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
  });

  it("does not write session credentials to logs during disconnect and reconnect", () => {
    const { manager, battle } = setupBattle();
    const token = manager.getSessionId("socket-mc1")!;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      manager.handleDisconnect("socket-mc1");
      manager.reconnect(battle.id, token, "socket-mc1-new");
      expect(JSON.stringify(log.mock.calls)).not.toContain(token);
    } finally {
      log.mockRestore();
    }
  });

  it("cancels disconnected-session cleanup when a battle is quarantined", () => {
    vi.useFakeTimers();
    try {
      const { manager, battle } = setupBattle();
      manager.handleDisconnect("socket-mc1");
      const phaseCallback = vi.fn();
      manager.setPhaseTimer(battle.id, 1000, phaseCallback);
      manager.quarantineBattle(battle.id);
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      expect(manager["persistence"].deleteSession).not.toHaveBeenCalled();
      expect(manager["persistence"].commitMemberRoles).not.toHaveBeenCalled();
      expect(phaseCallback).not.toHaveBeenCalled();
      expect(manager.findBattleBySocket("socket-admin")).toBeNull();
    } finally {
      vi.useRealTimers();
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

  it("creates one reusable invitation", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });
    const adminToken = manager.getAdminToken(battle.id)!;
    join(manager, battle.id, "socket-admin", "admin1", "admin", adminToken);

    const inviteToken = manager.createInvitation(battle.id, adminToken);
    expect(inviteToken).toBeTruthy();

    expect(manager.inspectInvitation(inviteToken!, battle.id)).toEqual({ roomId: battle.id });
    expect(manager.inspectInvitation(inviteToken!, battle.id)).toEqual({ roomId: battle.id });
    expect(manager.createInvitation(battle.id, adminToken)).toBe(inviteToken);
  });

  it("rejects invitation creation with invalid adminToken", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });

    const inviteToken = manager.createInvitation(battle.id, "wrong-token");
    expect(inviteToken).toBeNull();
  });

  it("regenerates an invitation and revokes the previous token", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });
    const adminToken = manager.getAdminToken(battle.id)!;

    const inviteToken = manager.createInvitation(battle.id, adminToken)!;
    const nextToken = manager.createInvitation(battle.id, adminToken, true)!;
    expect(nextToken).not.toBe(inviteToken);
    expect(manager.inspectInvitation(inviteToken, battle.id)).toBeNull();
    expect(manager.inspectInvitation(nextToken, battle.id)).toEqual({ roomId: battle.id });
  });

  it("rejects invalid invitation token", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1 });

    expect(manager.inspectInvitation("invalid-token", battle.id)).toBeNull();
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

  it("keeps a new guest waiting and preserves the display alias when assigning a role", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle();
    join(manager, battle.id, "socket-admin", "admin-1", "admin", manager.getAdminToken(battle.id));
    manager.joinBattle(battle.id, "socket-guest", { id: "opaque-user-id", name: "Hola", alias: "  Hola  " });

    expect(battle.members.find(member => member.userId === "opaque-user-id")).toMatchObject({ alias: "Hola", roles: [] });
    expect(manager.changeRole("socket-admin", "opaque-user-id", "participant")).toBe(battle);
    expect(battle.participants[0]).toMatchObject({ userId: "opaque-user-id", alias: "Hola", name: "Hola" });
  });

  it("supports co-admin, revocation and atomic admin transfer", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle();
    join(manager, battle.id, "socket-admin", "admin-1", "admin", manager.getAdminToken(battle.id));
    manager.joinBattle(battle.id, "socket-guest", { id: "guest-1", name: "Invitado", alias: "Invitado" });

    expect(manager.grantAdmin("socket-admin", "guest-1")).toBe(battle);
    expect(battle.members.find(member => member.userId === "guest-1")?.roles).toContain("admin");
    expect(manager.createInvitationForSocket("socket-guest")).toBeTruthy();
    expect(manager.revokeAdmin("socket-admin", "guest-1")).toBe(battle);
    expect(battle.members.find(member => member.userId === "guest-1")?.roles).not.toContain("admin");

    expect(manager.transferAdmin("socket-admin", "guest-1")).toBe(battle);
    expect(battle.adminId).toBe("guest-1");
    expect(battle.members.find(member => member.userId === "admin-1")?.roles).not.toContain("admin");
    expect(manager.createInvitationForSocket("socket-admin", true)).toBeNull();
    expect(manager.createInvitationForSocket("socket-guest", true)).toBeTruthy();
    expect(join(manager, battle.id, "socket-admin-rejoin", "admin-1", "admin", manager.getAdminToken(battle.id))).toBeNull();
    expect(manager.startBattle("socket-admin")).toEqual({ error: "Solo el admin puede iniciar la batalla" });
  });

  it("locks room voting to connected assigned members and excludes battlers", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1, votingSystem: "room_vote" });
    join(manager, battle.id, "socket-admin", "admin", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-judge", "judge", "judge");
    join(manager, battle.id, "socket-viewer", "viewer", "spectator");
    manager.joinBattle(battle.id, "socket-waiting", { id: "waiting", name: "Waiting", alias: "Waiting" });
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);

    expect(manager.submitRoomVote("socket-mc1", battle.id, "mc1")).toEqual({ error: "Los MC de esta batalla no pueden votar" });
    expect(manager.submitRoomVote("socket-waiting", battle.id, "mc1")).toEqual({ error: "Necesitas un rol asignado para votar" });
    expect(manager.submitRoomVote("socket-judge", battle.id, "mc1")).toMatchObject({ allVoted: false });
    expect(manager.submitRoomVote("socket-viewer", battle.id, "mc2")).toMatchObject({ allVoted: false });
    expect(manager.submitRoomVote("socket-admin", battle.id, "mc1")).toMatchObject({ allVoted: true });

    const result = manager.nextPhase(battle.id);
    expect(result).toMatchObject({ phase: "round_result", scores: { mc1: 2, mc2: 1 } });
  });

  it("persists the closed room voting roster before confirming the phase", async () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1, votingSystem: "room_vote" });
    join(manager, battle.id, "socket-admin", "admin", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    manager.startBattle("socket-admin");
    for (let i = 0; i < 3; i++) manager.nextPhase(battle.id);
    const commit = vi.spyOn(manager["persistence"], "commitRoomVotingRoster").mockRejectedValue(new Error("roster failure"));
    await expect(manager.nextPhaseDurably(battle.id)).rejects.toThrow("roster failure");
    expect(commit).toHaveBeenCalledWith(expect.objectContaining({ roundPhase: "voting" }), ["admin"]);
  });

  it("waits for free and room votes and propagates storage failures", async () => {
    const { manager, battle } = setupBattle();
    battle.mode.votingSystem = "free_vote";
    manager.startBattle("socket-admin");
    battle.roundPhase = "voting";
    vi.spyOn(manager["persistence"], "saveFreeVote").mockRejectedValue(new Error("free vote failure"));
    await expect(manager.submitFreeVoteDurably(battle.id, "judge1", battle.participants[0].userId)).rejects.toThrow("free vote failure");
    const room = new BattleRoomManager();
    const match = room.createBattle({ rounds: 1, votingSystem: "room_vote" });
    join(room, match.id, "admin", "admin", "admin", room.getAdminToken(match.id));
    join(room, match.id, "mc1", "mc1", "participant");
    join(room, match.id, "mc2", "mc2", "participant");
    room.startBattle("admin");
    for (let i = 0; i < 4; i++) room.nextPhase(match.id);
    vi.spyOn(room["persistence"], "saveRoomVote").mockRejectedValue(new Error("room vote failure"));
    await expect(room.submitRoomVoteDurably("admin", match.id, "mc1")).rejects.toThrow("room vote failure");
  });

  it("requires an eligible non-battling member to start room voting", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1, votingSystem: "room_vote" });
    join(manager, battle.id, "socket-admin", "admin", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    manager.changeRole("socket-admin", "admin", "participant");

    expect(manager.startBattle("socket-admin")).toEqual({ error: "El voto de sala necesita al menos un miembro conectado que no esté batallando" });
  });

  it("does not add late arrivals to a room voting roster", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1, votingSystem: "room_vote" });
    join(manager, battle.id, "socket-admin", "admin", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    join(manager, battle.id, "socket-late", "late", "spectator");

    expect(manager.submitRoomVote("socket-late", battle.id, "mc1")).toEqual({ error: "No formas parte del padrón de votación" });
    expect(manager.submitRoomVote("socket-admin", battle.id, "mc1")).toMatchObject({ allVoted: true });
  });

  it("stops waiting for a room voter who disconnects", () => {
    const manager = new BattleRoomManager();
    const battle = manager.createBattle({ rounds: 1, votingSystem: "room_vote" });
    join(manager, battle.id, "socket-admin", "admin", "admin", manager.getAdminToken(battle.id));
    join(manager, battle.id, "socket-mc1", "mc1", "participant");
    join(manager, battle.id, "socket-mc2", "mc2", "participant");
    join(manager, battle.id, "socket-viewer", "viewer", "spectator");
    manager.startBattle("socket-admin");
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);
    manager.nextPhase(battle.id);

    expect(manager.submitRoomVote("socket-admin", battle.id, "mc1")).toMatchObject({ allVoted: false });
    const viewerSession = manager.getSessionId("socket-viewer")!;
    manager.handleDisconnect("socket-viewer");
    expect(manager.isRoomVoteComplete(battle.id)).toBe(true);
    manager.reconnect(battle.id, viewerSession, "socket-viewer-reconnected");
    manager.leaveRoom("socket-viewer-reconnected");
  });
});
