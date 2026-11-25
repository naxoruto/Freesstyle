import { v4 as uuid } from "uuid";
import { randomBytes } from "node:crypto";
import type { Battle, BattleModeConfig, Participant, ReplicaConfig, UserRole, RoomMember, JudgeRubricVote, PatronEntryVote, PatronExtraVote, FreeVote, RoomVote, Word, RoundPhase } from "@freestyle/shared";
import { canJoinAsRole, ROLE_LIMITS, VALID_JUDGE_COUNTS, DEFAULT_RECONNECT_WINDOW_MS, FORMAT_DEFAULTS } from "@freestyle/shared";
import type { RoomInvitation } from "@freestyle/shared";
import { generateWord } from "../words/wordGenerator";
import { getDefaultModeConfig } from "../modes/modes";
import { calculatePatronResult, calculateRubricResult, calculateFreeVoteResult, calculateRoomVoteResult, isValidRubric } from "../scoring/scoring";
import { BattlePersistence } from "./battlePersistence";
import { generateShortId } from "./id";

interface SocketIdentity { userId: string; name: string; alias: string; }
interface SocketUser { socketId: string; battleId: string; sessionId: string; identity: SocketIdentity; identities: Map<UserRole, SocketIdentity>; }

interface SessionData {
  sessionId: string;
  battleId: string;
  identity: SocketIdentity;
  identities: Map<UserRole, SocketIdentity>;
  connected: boolean;
  disconnectedAt: string | null;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

const ACTIVE_RECONNECT_WINDOW_MS = 24 * 60 * 60 * 1000;

export class BattleRoomManager {
  private battles = new Map<string, Battle>();
  private sockets = new Map<string, SocketUser>();
  private sessions = new Map<string, SessionData>();
  private offlineMembers = new Map<string, Map<string, RoomMember>>();
  private adminTokens = new Map<string, string>();
  private invitations = new Map<string, RoomInvitation>();
  private rubricVotes = new Map<string, JudgeRubricVote[]>(); // key: battleId:round
  private patronEntryVotes = new Map<string, PatronEntryVote[]>();
  private patronExtraVotes = new Map<string, PatronExtraVote[]>();
  private freeVotes = new Map<string, FreeVote[]>(); // key: battleId:round
  private roomVotes = new Map<string, RoomVote[]>();
  private roomVotingRosters = new Map<string, Set<string>>();
  private recoveryPaused = new Set<string>();
  private phaseTimers = new Map<string, NodeJS.Timeout>();
  // Track a unique token per phase transition to prevent duplicate advances
  private phaseTokens = new Map<string, string>();
  // Track admin IDs per battle to enforce the 2-admin limit
  private battleAdmins = new Map<string, Set<string>>();
  private persistence: BattlePersistence;
  private pendingCreations = new Map<string, Promise<Battle>>();
  onSessionCleanup?: (battleId: string) => void;
  onPersistenceFailure?: (battleId: string) => void;

  constructor(persistence?: BattlePersistence) {
    this.persistence = persistence ?? new BattlePersistence();
  }

  private runPersistence(battleId: string, promise: Promise<unknown>): void {
    void promise.catch((error) => {
      console.error("No se pudo guardar el estado de la sala", error);
      this.onPersistenceFailure?.(battleId);
    });
  }

  createBattle(mode?: Partial<BattleModeConfig>): Battle {
    const id = generateShortId();
    const format = mode?.format ?? "1x1";
    const fmtDefaults = FORMAT_DEFAULTS[format];
    const modeName = mode?.mode ?? "clasico";
    const battleMode: BattleModeConfig = {
      ...getDefaultModeConfig(modeName),
      format,
      entriesPerParticipant: fmtDefaults.entriesPerParticipant,
      timerMode: fmtDefaults.timerMode,
      turnStructure: fmtDefaults.turnStructure,
      timePerTurn: fmtDefaults.defaultTimePerTurn,
      rounds: fmtDefaults.defaultRounds,
      ...mode,
      showScoresToSpectators: true,
    };
    if (battleMode.timerMode === "countdown" && ![60, 120].includes(battleMode.timePerTurn)) battleMode.timePerTurn = 60;
    if (battleMode.timerMode === "manual") battleMode.turnStructure = "one_way";
    const battle: Battle = {
      id,
      mode: battleMode,
      status: "lobby",
      participants: [],
      judges: [],
      spectators: [],
      members: [],
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
    };
    this.battles.set(id, battle);
    this.adminTokens.set(id, uuid());
    this.battleAdmins.set(id, new Set());
    const creation = this.persistence.create(battle);
    this.pendingCreations.set(id, creation);
    void creation.then(
      () => this.pendingCreations.delete(id),
      (err) => { this.pendingCreations.delete(id); console.error("Error persistiendo batalla:", err); },
    );
    console.log(`🎮 Batalla creada: ${id} (modo: ${battle.mode.mode})`);
    return battle;
  }

  async createBattleDurably(mode?: Partial<BattleModeConfig>): Promise<Battle> {
    const battle = this.createBattle(mode);
    const creation = this.pendingCreations.get(battle.id);
    if (!creation) throw new Error("No se pudo verificar la creación de la batalla");
    try {
      await creation;
      return battle;
    } catch (error) {
      this.battles.delete(battle.id);
      this.adminTokens.delete(battle.id);
      this.battleAdmins.delete(battle.id);
      throw error;
    }
  }

  getAdminToken(battleId: string): string | undefined {
    return this.adminTokens.get(battleId.toLowerCase());
  }

  createInvitation(battleId: string, adminToken: string, regenerate = false): string | null {
    const normalizedId = battleId.toLowerCase();
    const battle = this.battles.get(normalizedId);
    if (!battle) return null;
    const expectedAdminToken = this.adminTokens.get(normalizedId);
    if (!expectedAdminToken || !adminToken || adminToken !== expectedAdminToken) return null;

    return this.issueInvitation(normalizedId, regenerate);
  }

  private issueInvitation(normalizedId: string, regenerate: boolean): string {
    const current = [...this.invitations.values()].find(invitation => invitation.roomId === normalizedId);
    if (current && !regenerate) return current.token;
    if (current) this.invitations.delete(current.token);

    const token = uuid().slice(0, 12);
    const invitation: RoomInvitation = {
      token,
      roomId: normalizedId,
      createdAt: new Date().toISOString(),
      createdBy: "admin",
    };
    this.invitations.set(token, invitation);
    return token;
  }

  createInvitationForSocket(socketId: string, regenerate = false): string | null {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || !this.isAdmin(socketId, battle)) return null;
    return this.issueInvitation(battle.id, regenerate);
  }

  inspectInvitation(inviteToken: string, battleId?: string): { roomId: string } | null {
    const invitation = this.invitations.get(inviteToken);
    if (!invitation) return null;
    if (battleId && invitation.roomId !== battleId.toLowerCase()) return null;
    return this.battles.has(invitation.roomId) ? { roomId: invitation.roomId } : null;
  }

  getJoinError(battleId: string, user: { id: string; alias?: string; role?: UserRole }, adminToken?: string, inviteToken?: string): string | undefined {
    const normalizedId = battleId.toLowerCase();
    const battle = this.battles.get(normalizedId);
    if (!battle) return "Batalla no encontrada";
    if (!this.sanitizeAlias(user.alias ?? "")) return "Escribe un alias válido";
    if (inviteToken && !this.inspectInvitation(inviteToken, normalizedId)) return "Invitación inválida o revocada";
    if (user.role === "admin") {
      const expectedAdminToken = this.adminTokens.get(normalizedId);
      if (!expectedAdminToken || !adminToken || adminToken !== expectedAdminToken) return "Acceso de admin inválido";
      const admins = this.battleAdmins.get(normalizedId);
      if (admins && admins.size > 0 && !admins.has(user.id)) return "El acceso inicial de admin ya fue utilizado";
    }
    if (user.role && !canJoinAsRole(this.countRoleInBattle(battle, user.role), user.role)) return `El límite de ${user.role} ya fue alcanzado`;
    return undefined;
  }

  private countRoleInBattle(battle: Battle, role: UserRole): number {
    switch (role) {
      case "judge": return battle.judges.length;
      case "participant": return battle.participants.length;
      case "admin": return this.battleAdmins.get(battle.id)?.size ?? 0;
      case "spectator": return battle.spectators.length;
      case "host": return battle.hostId ? 1 : 0;
    }
  }

  joinBattle(battleId: string, socketId: string, user: { id: string; name: string; alias: string; role?: UserRole }, adminToken?: string, inviteToken?: string): Battle | null {
    const normalizedId = battleId.toLowerCase();
    const battle = this.battles.get(normalizedId);
    if (!battle || this.getJoinError(normalizedId, user, adminToken, inviteToken)) return null;

    const alias = this.sanitizeAlias(user.alias);
    if (!alias) return null;
    const socketIdentity: SocketIdentity = { userId: user.id, name: alias, alias };

    const existingSocket = this.sockets.get(socketId);
    if (existingSocket && existingSocket.battleId !== normalizedId) return null;
    const sessionId = existingSocket?.sessionId ?? randomBytes(32).toString("hex");
    const socketUser = existingSocket ?? { socketId, battleId: normalizedId, sessionId, identity: socketIdentity, identities: new Map<UserRole, SocketIdentity>() };
    socketUser.identity = socketIdentity;
    if (user.role) socketUser.identities.set(user.role, socketIdentity);
    this.sockets.set(socketId, socketUser);

    const session = this.sessions.get(sessionId) ?? {
      sessionId,
      battleId: normalizedId,
      identity: socketIdentity,
      identities: new Map<UserRole, SocketIdentity>(),
      connected: true,
      disconnectedAt: null,
    };
    session.identity = socketIdentity;
    if (user.role) session.identities.set(user.role, socketIdentity);
    session.connected = true;
    session.disconnectedAt = null;
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = undefined;
    }
    this.sessions.set(sessionId, session);

    if (user.role === "admin") {
      battle.adminId = user.id;
      const admins = this.battleAdmins.get(normalizedId);
      if (admins) admins.add(user.id);
    }

    if (user.role === "judge") {
      if (!battle.judges.find(j => j.id === user.id)) battle.judges.push({ id: user.id, alias: user.alias });
      this.runPersistence(normalizedId, this.persistence.addJudge(normalizedId, { id: user.id, alias: user.alias }));
    }
    if (user.role === "participant") {
      const exists = battle.participants.find(p => p.userId === user.id);
      if (!exists) {
        const participant: Participant = { userId: user.id, name: user.name, alias: user.alias, isActive: false, currentScore: 0, roundsWon: 0 };
        battle.participants.push(participant);
        this.runPersistence(normalizedId, this.persistence.addParticipant(normalizedId, participant));
      }
    }
    if (user.role === "spectator") {
      if (!battle.spectators.find(s => s.id === user.id)) battle.spectators.push({ id: user.id, alias: user.alias });
      this.runPersistence(normalizedId, this.persistence.addSpectator(normalizedId, { id: user.id, alias: user.alias }));
    }
    if (user.role === "host") {
      battle.hostId = user.id;
    }
    this.syncMembers(battle);
    return battle;
  }

  leaveRoom(socketId: string): Battle | null {
    const user = this.sockets.get(socketId);
    if (!user) return null;

    if (user.sessionId) {
      const session = this.sessions.get(user.sessionId);
      if (session?.cleanupTimer) {
        clearTimeout(session.cleanupTimer);
      }
      this.sessions.delete(user.sessionId);
    }

    this.sockets.delete(socketId);
    const battle = this.battles.get(user.battleId);
    if (!battle) return null;
    const participantId = user.identities.get("participant")?.userId;
    const judgeId = user.identities.get("judge")?.userId;
    const spectatorId = user.identities.get("spectator")?.userId;
    const hostId = user.identities.get("host")?.userId;
    const adminId = user.identities.get("admin")?.userId;
    if (participantId) battle.participants = battle.participants.filter(p => p.userId !== participantId);
    if (judgeId) battle.judges = battle.judges.filter(j => j.id !== judgeId);
    if (spectatorId) battle.spectators = battle.spectators.filter(s => s.id !== spectatorId);
    if (hostId && battle.hostId === hostId) battle.hostId = undefined;
    if (adminId) {
      const admins = this.battleAdmins.get(user.battleId);
      if (admins) admins.delete(adminId);
    }
    // Sync removals to DB
    if (participantId) this.runPersistence(user.battleId, this.persistence.removeParticipant(user.battleId, participantId));
    if (judgeId) this.runPersistence(user.battleId, this.persistence.removeJudge(user.battleId, judgeId));
    if (spectatorId) this.runPersistence(user.battleId, this.persistence.removeSpectator(user.battleId, spectatorId));
    this.syncMembers(battle);
    this.runPersistence(user.battleId, this.persistence.update(battle));
    return battle;
  }

  getSessionId(socketId: string): string | undefined {
    return this.sockets.get(socketId)?.sessionId;
  }

  hasMember(battleId: string, userId: string): boolean {
    return this.battles.get(battleId.toLowerCase())?.members.some(member => member.userId === userId) ?? false;
  }

  quarantineBattle(battleId: string): void {
    const normalizedId = battleId.toLowerCase();
    this.cancelPhaseTimer(normalizedId);
    for (const [token, session] of this.sessions) {
      if (session.battleId !== normalizedId) continue;
      if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
      this.sessions.delete(token);
    }
    for (const [socketId, socket] of this.sockets) {
      if (socket.battleId === normalizedId) this.sockets.delete(socketId);
    }
  }

  async persistSessionForSocket(socketId: string): Promise<void> {
    const socket = this.sockets.get(socketId);
    if (!socket) throw new Error("Sesión no encontrada");
    const battle = this.battles.get(socket.battleId);
    const windowMs = battle && (battle.status === "in_progress" || battle.status === "replica") ? ACTIVE_RECONNECT_WINDOW_MS : DEFAULT_RECONNECT_WINDOW_MS;
    await this.persistence.saveSession({
      token: socket.sessionId, roomId: socket.battleId, userId: socket.identity.userId,
      alias: socket.identity.alias, roles: [...socket.identities.keys()],
      expiresAt: new Date(Date.now() + windowMs),
    });
  }

  async persistMemberRoles(battleId: string): Promise<void> {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle) throw new Error("Batalla no encontrada");
    await this.persistence.commitMemberRoles(battle);
  }

  async revokePersistedSession(battleId: string, token: string): Promise<void> {
    await this.persistence.deleteSession(battleId, token);
  }

  async loadLobbyBattlesFromDb(): Promise<void> {
    const battles = await this.persistence.loadActiveBattles();
    for (const battle of battles) {
      if (battle.status !== "lobby") continue;
      await this.restoreMembers(battle);
    }
  }

  private async restoreMembers(battle: Battle): Promise<void> {
    const admins = new Set(battle.members.filter(member => member.roles.includes("admin")).map(member => member.userId));
    this.battleAdmins.set(battle.id, admins);
    battle.adminId ??= [...admins][0];
    this.battles.set(battle.id, battle);
    const offline = new Map<string, RoomMember>();
    for (const member of battle.members) offline.set(member.userId, { ...member, connected: false });
    for (const session of await this.persistence.listSessionMembers(battle.id)) {
      if (!offline.has(session.userId)) offline.set(session.userId, { userId: session.userId, alias: session.alias, roles: [], connected: false });
    }
    if (battle.hostId) {
      const host = offline.get(battle.hostId);
      if (host && !host.roles.includes("host")) host.roles.push("host");
    }
    this.offlineMembers.set(battle.id, offline);
    battle.members = [...offline.values()];
  }

  async reconnectPersisted(battleId: string, sessionId: string, socketId: string): Promise<{ battle: Battle; sessionId: string } | { error: string }> {
    const normalizedId = battleId.toLowerCase();
    if (this.sessions.has(sessionId)) return this.reconnect(normalizedId, sessionId, socketId);
    const battle = this.battles.get(normalizedId);
    if (!battle || !["lobby", "in_progress", "replica"].includes(battle.status)) return { error: "Sesión no encontrada" };
    const stored = await this.persistence.findSession(normalizedId, sessionId);
    if (!stored) return { error: "Sesión no encontrada" };
    const member = this.offlineMembers.get(normalizedId)?.get(stored.userId);
    if (!member || stored.roles.some(role => !member.roles.includes(role as UserRole))) return { error: "Sesión no encontrada" };
    if ([...this.sessions.values()].some(session => session.battleId === normalizedId && session.identity.userId === stored.userId && session.connected)) return { error: "La sesión ya está conectada" };
    const identity = { userId: stored.userId, name: stored.alias, alias: stored.alias };
    const identities = new Map<UserRole, SocketIdentity>(stored.roles.map(role => [role as UserRole, identity]));
    this.offlineMembers.get(normalizedId)?.delete(stored.userId);
    this.sessions.set(sessionId, { sessionId, battleId: normalizedId, identity, identities, connected: false, disconnectedAt: new Date().toISOString() });
    return this.reconnect(normalizedId, sessionId, socketId);
  }

  handleDisconnect(socketId: string): { battleId: string } | null {
    const user = this.sockets.get(socketId);
    if (!user || !user.sessionId) return null;

    const session = this.sessions.get(user.sessionId);
    if (!session) return null;

    this.sockets.delete(socketId);
    session.connected = false;
    session.disconnectedAt = new Date().toISOString();

    const battleId = session.battleId;
    const sessionId = session.sessionId;
    const battle = this.battles.get(battleId);
    const windowMs = battle && (battle.status === "in_progress" || battle.status === "replica") ? ACTIVE_RECONNECT_WINDOW_MS : DEFAULT_RECONNECT_WINDOW_MS;

    this.sessions.set(sessionId, session);

    session.cleanupTimer = setTimeout(() => {
      this.cleanupDisconnectedSession(battleId, sessionId);
    }, windowMs);

    if (battle) this.syncMembers(battle);

    console.log(`🔌 Sesión desconectada en batalla ${battleId} (limpieza en ${windowMs / 1000}s)`);
    return { battleId };
  }

  reconnect(battleId: string, sessionId: string, newSocketId: string): { battle: Battle; sessionId: string } | { error: string } {
    const normalizedId = battleId.toLowerCase();
    const session = this.sessions.get(sessionId);
    if (!session || session.battleId !== normalizedId) return { error: "Sesión no encontrada" };
    const battle = this.battles.get(normalizedId);
    if (!battle) return { error: "Batalla no encontrada" };

    if (session.connected) return { error: "La sesión ya está conectada" };

    const disconnectedMs = session.disconnectedAt
      ? Date.now() - new Date(session.disconnectedAt).getTime()
      : Number.MAX_SAFE_INTEGER;

    const windowMs = battle.status === "in_progress" || battle.status === "replica" ? ACTIVE_RECONNECT_WINDOW_MS : DEFAULT_RECONNECT_WINDOW_MS;
    if (disconnectedMs > windowMs) {
      this.cleanupDisconnectedSession(normalizedId, sessionId);
      return { error: "La sesión ha expirado" };
    }

    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = undefined;
    }

    session.connected = true;
    session.disconnectedAt = null;

    const socketUser: SocketUser = {
      socketId: newSocketId,
      battleId: normalizedId,
      sessionId,
      identity: session.identity,
      identities: new Map(session.identities),
    };
    this.sockets.set(newSocketId, socketUser);
    this.sessions.set(sessionId, session);

    this.syncMembers(battle);

    console.log(`🔁 Sesión reconectada a batalla ${normalizedId}`);
    return { battle, sessionId };
  }

  private cleanupDisconnectedSession(battleId: string, sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.runPersistence(battleId, this.persistence.deleteSession(battleId, sessionId));
    this.sessions.delete(sessionId);

    const battle = this.battles.get(battleId);
    if (!battle) return;

    const active = battle.status === "in_progress" || battle.status === "replica";
    if (active) {
      const roles = [...session.identities.keys()].filter(role => role === "participant" || role === "judge");
      if (roles.length) {
        const offline = this.offlineMembers.get(battleId) ?? new Map<string, RoomMember>();
        offline.set(session.identity.userId, { userId: session.identity.userId, alias: session.identity.alias, roles, connected: false });
        this.offlineMembers.set(battleId, offline);
      }
    }

    for (const [role, identity] of session.identities) {
      if (role === "participant" && !active) {
        battle.participants = battle.participants.filter(p => p.userId !== identity.userId);
        this.runPersistence(battleId, this.persistence.removeParticipant(battleId, identity.userId));
      }
      if (role === "judge" && !active) {
        battle.judges = battle.judges.filter(j => j.id !== identity.userId);
        this.runPersistence(battleId, this.persistence.removeJudge(battleId, identity.userId));
      }
      if (role === "spectator") {
        battle.spectators = battle.spectators.filter(s => s.id !== identity.userId);
        this.runPersistence(battleId, this.persistence.removeSpectator(battleId, identity.userId));
      }
      if (role === "host" && battle.hostId === identity.userId) {
        battle.hostId = undefined;
        if (battle.status === "in_progress" && battle.mode.liveControlEnabled && battle.mode.timerMode === "manual") {
          console.log(`⚠️ Host desconectado en batalla ${battleId} con modo manual. Sin controlador activo.`);
        }
      }
      if (role === "admin") {
        const admins = this.battleAdmins.get(battleId);
        if (admins) admins.delete(identity.userId);
      }
    }

    this.syncMembers(battle);
    this.runPersistence(battleId, this.persistence.update(battle));
    this.runPersistence(battleId, this.persistence.commitMemberRoles(battle));
    console.log(`🧹 Sesión limpiada de batalla ${battleId}`);
    this.onSessionCleanup?.(battleId);
  }

  startBattle(socketId: string, persist = true): { battle: Battle } | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (!battle) return { error: "No estás en ninguna batalla" };
    if (this.isRecoveryPaused(battle.id)) return { error: "La batalla está pausada para recuperación" };
    if (battle.status !== "lobby") return { error: "La batalla ya se ha iniciado" };
    if (!this.isAdmin(socketId, battle)) return { error: "Solo el admin puede iniciar la batalla" };
    if (battle.participants.length < 2) return { error: "Se necesitan al menos 2 participantes" };
    if (!battle.mode.exhibition) {
      if (battle.mode.votingSystem === "room_vote") {
        const participantIds = new Set(battle.participants.map(participant => participant.userId));
        const hasEligibleVoter = battle.members.some(member => member.connected && member.roles.length > 0 && !participantIds.has(member.userId));
        if (!hasEligibleVoter) return { error: "El voto de sala necesita al menos un miembro conectado que no esté batallando" };
      } else if (!VALID_JUDGE_COUNTS.has(battle.judges.length)) {
        return { error: "La mesa debe tener 1, 3 o 5 jueces" };
      }
    }

    const adminCount = this.battleAdmins.get(battle.id)?.size ?? 0;
    const hasController = adminCount > 0 || Boolean(battle.hostId);
    if (battle.mode.liveControlEnabled && battle.mode.timerMode === "manual" && !hasController) {
      return { error: "El modo por entradas necesita un admin u host para controlar. Activa el control en vivo o asigna un host." };
    }
    if (!battle.mode.liveControlEnabled && battle.mode.timerMode === "manual") {
      return { error: "El modo por entradas requiere control en vivo activado." };
    }

    battle.status = "in_progress";
    battle.currentRound = 1;
    battle.roundPhase = "countdown";
    battle.totalScores = {};
    battle.roundResults = [];
    battle.turnSequenceIndex = 0;
    battle.replicaCount = 0;
    battle.entriesRemaining = Object.fromEntries(
      battle.participants.slice(0, ROLE_LIMITS.participant).map(participant => [participant.userId, battle.mode.entriesPerParticipant]),
    );

    // Reorder participants so the chosen first MC is at index 0
    const firstId = battle.mode.firstTurnParticipantId;
    if (firstId && battle.participants[1]?.userId === firstId) {
      [battle.participants[0], battle.participants[1]] = [battle.participants[1], battle.participants[0]];
    } else if (!firstId) {
      // Random: 50% chance to swap
      if (Math.random() < 0.5) {
        [battle.participants[0], battle.participants[1]] = [battle.participants[1], battle.participants[0]];
      }
    }

    this.refreshPhaseClock(battle);
    if (persist) this.runPersistence(battle.id, this.persistence.update(battle));
    return { battle };
  }

  async startBattleDurably(socketId: string): Promise<ReturnType<BattleRoomManager["startBattle"]>> {
    const result = this.startBattle(socketId, false);
    if ("battle" in result) await this.persistence.commitBattleStart(result.battle, new Date(Date.now() + ACTIVE_RECONNECT_WINDOW_MS));
    return result;
  }

  /**
   * Get the current phase token for a battle.
   * Clients should send this token with next_phase to prevent duplicate advances.
   */
  getPhaseToken(battleId: string): string | undefined {
    return this.phaseTokens.get(battleId.toLowerCase());
  }

  private phaseDurationMs(battle: Battle): number | undefined {
    if (battle.status !== "in_progress" && battle.status !== "replica") return undefined;
    if (battle.roundPhase === "countdown" || battle.roundPhase === "pause") return 4000;
    if ((battle.roundPhase === "mc1_turn" || battle.roundPhase === "mc2_turn") && battle.mode.timerMode === "countdown" && battle.mode.timePerTurn > 0) return battle.mode.timePerTurn * 1000;
    if (battle.roundPhase === "voting" && battle.judges.length === 0 && battle.mode.votingSystem !== "room_vote") return 3000;
    return undefined;
  }

  private refreshPhaseClock(battle: Battle, token = randomBytes(16).toString("hex")): void {
    const duration = this.phaseDurationMs(battle);
    battle.phaseToken = token;
    battle.phaseDeadline = duration === undefined ? undefined : new Date(Date.now() + duration).toISOString();
    battle.timeRemaining = duration === undefined ? 0 : Math.ceil(duration / 1000);
    this.phaseTokens.set(battle.id, token);
  }

  getPhaseTiming(battleId: string, now = Date.now()): { state: "untimed" | "unknown" | "pending" | "expired"; deadline?: string; timeRemaining?: number } | undefined {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle) return undefined;
    if (!battle.phaseDeadline) return { state: this.phaseDurationMs(battle) === undefined ? "untimed" : "unknown" };
    const deadline = Date.parse(battle.phaseDeadline);
    if (!Number.isFinite(deadline)) return { state: "unknown" };
    return { state: deadline <= now ? "expired" : "pending", deadline: battle.phaseDeadline, timeRemaining: Math.max(0, Math.ceil((deadline - now) / 1000)) };
  }

  /**
   * Cancel any pending phase timer for a battle.
   */
  cancelPhaseTimer(battleId: string): void {
    const key = battleId.toLowerCase();
    const existing = this.phaseTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.phaseTimers.delete(key);
    }
  }

  /**
   * Set a phase timer that will call the callback after `ms` milliseconds.
   * Any existing timer for this battle is cancelled first.
   */
  setPhaseTimer(battleId: string, ms: number, callback: () => void): void {
    this.cancelPhaseTimer(battleId);
    const key = battleId.toLowerCase();
    if (this.isRecoveryPaused(key)) return;
    const token = this.phaseTokens.get(key);
    const deadline = this.battles.get(key)?.phaseDeadline;
    const delay = deadline ? Math.max(0, Date.parse(deadline) - Date.now()) : ms;
    const timer = setTimeout(() => {
      if (this.phaseTimers.get(key) !== timer || this.phaseTokens.get(key) !== token || this.isRecoveryPaused(key)) return;
      this.phaseTimers.delete(key);
      callback();
    }, delay);
    this.phaseTimers.set(key, timer);
  }

  // Avanzar a la siguiente fase de la ronda
  // `expectedToken` is used for idempotency: if provided and it doesn't match
  // the current phase token, the call is a duplicate and is rejected.
  nextPhase(battleId: string, expectedToken?: string, isAuto = false): { battle: Battle; word?: Word; phase: RoundPhase; participantId?: string; timeRemaining?: number; phaseToken: string; rubricVotes?: JudgeRubricVote[]; scores?: Record<string, number> } | { error: string } {
    const { result, write } = this.preparePhaseTransition(battleId, expectedToken, isAuto);
    if (write) this.runPersistence(battleId, write);
    return result;
  }

  async nextPhaseDurably(battleId: string, expectedToken?: string, isAuto = false): Promise<ReturnType<BattleRoomManager["nextPhase"]>> {
    const { result, write } = this.preparePhaseTransition(battleId, expectedToken, isAuto);
    await write;
    return result;
  }

  private preparePhaseTransition(battleId: string, expectedToken?: string, isAuto = false): { result: ReturnType<BattleRoomManager["nextPhase"]>; write?: Promise<unknown> } {
    const key = battleId.toLowerCase();
    const previousToken = this.phaseTokens.get(key);
    const previousPhase = this.battles.get(key)?.roundPhase;
    const previousResults = this.battles.get(key)?.roundResults.length ?? 0;
    const result = this.advancePhase(battleId, expectedToken, isAuto);
    if ("battle" in result) {
      this.refreshPhaseClock(result.battle, result.phaseToken);
      result.timeRemaining = result.battle.timeRemaining;
      const newResult = result.battle.roundResults.length > previousResults ? result.battle.roundResults.at(-1) : undefined;
      const roster = result.battle.mode.votingSystem === "room_vote" && result.phase === "voting" && previousPhase !== "voting"
        ? this.roomVotingRosters.get(this.roomVoteKey(result.battle)) : undefined;
      const write = newResult
        ? this.persistence.commitBattleAndResult(result.battle, { ...newResult, replica: newResult.replica ?? 0 })
        : roster ? this.persistence.commitRoomVotingRoster(result.battle, [...roster]) : this.persistence.update(result.battle);
      return { result, write };
    }
    else if (previousToken) this.phaseTokens.set(key, previousToken);
    else this.phaseTokens.delete(key);
    return { result };
  }

  private advancePhase(battleId: string, expectedToken?: string, isAuto = false): { battle: Battle; word?: Word; phase: RoundPhase; participantId?: string; timeRemaining?: number; phaseToken: string; rubricVotes?: JudgeRubricVote[]; scores?: Record<string, number> } | { error: string } {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle || (battle.status !== "in_progress" && battle.status !== "replica")) return { error: "Batalla no encontrada" };
    if (this.isRecoveryPaused(battleId)) return { error: "La batalla está pausada para recuperación" };

    if (!isAuto && !battle.mode.liveControlEnabled && expectedToken) {
      return { error: "El control en vivo está desactivado. La batalla avanza automáticamente." };
    }

    // Idempotency check: if token was provided and doesn't match, reject
    const currentToken = this.phaseTokens.get(battle.id);
    if (expectedToken && currentToken && expectedToken !== currentToken) {
      console.log(`⏭️ Duplicate next_phase rejected for ${battle.id} (token mismatch: expected ${expectedToken}, current ${currentToken})`);
      return { error: "Transición duplicada, ignorada" };
    }

    // Cancel any pending timer since we're advancing manually
    this.cancelPhaseTimer(battle.id);

    const mc1 = battle.participants[0];
    const mc2 = battle.participants[1];
    if (!mc1 || !mc2) return { error: "Faltan participantes" };

    // Generate new token for the new phase
    const newToken = uuid().slice(0, 8);
    this.phaseTokens.set(battle.id, newToken);

    switch (battle.roundPhase) {
      case "countdown": {
        battle.turnSequenceIndex = 0;
        const participantId = this.getTurnSequence(battle)[0];
        battle.roundPhase = participantId === mc1.userId ? "mc1_turn" : "mc2_turn";
        battle.currentTurn = participantId;
        battle.timeRemaining = battle.mode.timerMode === "countdown" ? battle.mode.timePerTurn : 0;
        const usesConcept = battle.mode.mode === "clasico" || (battle.mode.mode === "variado" && battle.currentRound % 2 === 0);
        if (!usesConcept) {
          battle.currentWord = undefined;
          return { battle, phase: battle.roundPhase, participantId, timeRemaining: battle.timeRemaining, phaseToken: newToken };
        }
        const word = generateWord(battle.mode.category, battle.mode.difficulty);
        battle.currentWord = word;
        return { battle, word, phase: battle.roundPhase, participantId, timeRemaining: battle.timeRemaining, phaseToken: newToken };
      }
      case "mc1_turn":
      case "mc2_turn": {
        const sequence = this.getTurnSequence(battle);
        if (battle.turnSequenceIndex >= sequence.length - 1) {
          if (battle.mode.exhibition) {
            battle.roundPhase = "round_result";
            battle.currentTurn = "";
            return { battle, phase: "round_result", phaseToken: newToken };
          }
          battle.roundPhase = "voting";
          battle.currentTurn = "";
          if (battle.mode.votingSystem === "room_vote") this.lockRoomVotingRoster(battle);
          return { battle, phase: "voting", phaseToken: newToken };
        }
        battle.roundPhase = "pause";
        battle.currentTurn = "";
        return { battle, phase: "pause", phaseToken: newToken };
      }
      case "pause": {
        const sequence = this.getTurnSequence(battle);
        battle.turnSequenceIndex++;
        const participantId = sequence[battle.turnSequenceIndex];
        battle.roundPhase = participantId === mc1.userId ? "mc1_turn" : "mc2_turn";
        battle.currentTurn = participantId;
        battle.timeRemaining = battle.mode.timerMode === "countdown" ? battle.mode.timePerTurn : 0;
        return { battle, phase: battle.roundPhase, participantId, timeRemaining: battle.timeRemaining, phaseToken: newToken };
      }
      case "voting": {
        if (battle.mode.votingSystem === "room_vote") {
          const voteKey = this.roomVoteKey(battle);
          const roundVotes = this.roomVotes.get(voteKey) ?? [];
          if (!this.isRoomVoteComplete(battle.id) || roundVotes.length === 0) {
            return { error: "Esperando votos de la sala..." };
          }
          const { scores, winnerId } = calculateRoomVoteResult(roundVotes);
          this.addToTotalScores(battle, scores);
          this.recordRoundResult(battle, scores, winnerId, roundVotes.map(vote => ({
            judgeId: vote.voterId,
            judgeName: vote.voterName,
            votedForId: vote.votedForId,
          })));
          const winner = battle.participants.find(participant => participant.userId === winnerId);
          if (winner) winner.roundsWon++;
          battle.roundPhase = "round_result";
          return { battle, phase: "round_result", phaseToken: newToken, rubricVotes: [], scores };
        }

        if (battle.mode.votingSystem === "patron") {
          const voteKey = this.roundVoteKey(battle);
          const extraVotes = this.patronExtraVotes.get(voteKey) ?? [];
          if (!battle.judges.every(judge => extraVotes.some(vote => vote.judgeId === judge.id))) {
            return { error: "Esperando puntos extra de los jueces..." };
          }
          const entryVotes = Array.from(this.patronEntryVotes.entries())
            .filter(([key]) => key.startsWith(`${voteKey}:`))
            .flatMap(([, votes]) => votes);
          const { scores, winnerId } = calculatePatronResult(entryVotes, extraVotes);
          this.addToTotalScores(battle, scores);
          this.recordRoundResult(battle, scores, winnerId, this.getPatronJudgeVotes(battle, entryVotes, extraVotes));
          const winner = battle.participants.find(participant => participant.userId === winnerId);
          if (winner) winner.roundsWon++;
          battle.roundPhase = "round_result";
          return { battle, phase: "round_result", phaseToken: newToken, rubricVotes: [], scores };
        }

        if (battle.mode.votingSystem === "free_vote") {
          const voteKey = this.roundVoteKey(battle);
          const roundVotes = this.freeVotes.get(voteKey) ?? [];
          const allJudged = battle.judges.length === 0 || roundVotes.length >= battle.judges.length;

          if (allJudged && roundVotes.length > 0) {
            const { scores, winnerId } = calculateFreeVoteResult(roundVotes);
            this.addToTotalScores(battle, scores);
            const judgeVotes = roundVotes.map(v => ({
              judgeId: v.judgeId,
              judgeName: v.judgeName,
              votedForId: v.votedForId,
            }));
            this.recordRoundResult(battle, scores, winnerId, judgeVotes);
            const winner = battle.participants.find(p => p.userId === winnerId);
            if (winner) winner.roundsWon++;
            battle.roundPhase = "round_result";
            return { battle, phase: "round_result", phaseToken: newToken, rubricVotes: [], scores };
          }
          return { error: "Esperando votos de los jueces..." };
        }

        // Ya se votó, verificar si todos los jueces votaron con rúbrica
        const voteKey = this.roundVoteKey(battle);
        const roundVotes = this.rubricVotes.get(voteKey) || [];
        const allJudged = battle.judges.length === 0 || roundVotes.length >= battle.judges.length;

        if (allJudged && roundVotes.length > 0) {
          const { scores, winnerId } = calculateRubricResult(roundVotes);
          this.addToTotalScores(battle, scores);
          this.recordRoundResult(battle, scores, winnerId, roundVotes.map(vote => {
            const mc1Total = Object.values(vote.mc1Scores).reduce((sum, value) => sum + value, 0);
            const mc2Total = Object.values(vote.mc2Scores).reduce((sum, value) => sum + value, 0);
            return { judgeId: vote.judgeId, judgeName: vote.judgeName, votedForId: mc1Total === mc2Total ? undefined : mc1Total > mc2Total ? vote.mc1Id : vote.mc2Id };
          }));
          // Actualizar rounds ganados
          const winner = battle.participants.find(p => p.userId === winnerId);
          if (winner) winner.roundsWon++;

          battle.roundPhase = "round_result";
          return { battle, phase: "round_result", phaseToken: newToken, rubricVotes: roundVotes, scores };
        }
        return { error: "Esperando votos de los jueces..." };
      }
      case "round_result": {
        // Avanzar a siguiente ronda
        if (battle.currentRound >= battle.mode.rounds) {
          if (this.shouldStartReplica(battle)) {
            battle.replicaCount++;
            battle.mode = { ...battle.replicaConfig!.mode };
            battle.status = "replica";
            battle.currentRound = 1;
            battle.roundPhase = "countdown";
            battle.currentTurn = "";
            battle.turnSequenceIndex = 0;
            battle.currentWord = undefined;
            battle.entriesRemaining = Object.fromEntries(
              battle.participants.slice(0, ROLE_LIMITS.participant).map(participant => [participant.userId, battle.mode.entriesPerParticipant]),
            );
            return { battle, phase: "countdown", phaseToken: newToken };
          }
          battle.status = "finished";
          return { battle, phase: "round_result", phaseToken: newToken };
        }
        battle.currentRound++;
        battle.roundPhase = "countdown";
        battle.turnSequenceIndex = 0;
        battle.entriesRemaining = Object.fromEntries(
          battle.participants.slice(0, ROLE_LIMITS.participant).map(participant => [participant.userId, battle.mode.entriesPerParticipant]),
        );
        return { battle, phase: "countdown", phaseToken: newToken };
      }
      default:
        return { error: "Fase desconocida" };
    }
  }

  submitRubricVote(battleId: string, judgeId: string, round: number, mc1Id: string, mc2Id: string, mc1Scores: { flow: number; lirica: number; ingenio: number; presencia: number; tecnica: number }, mc2Scores: { flow: number; lirica: number; ingenio: number; presencia: number; tecnica: number }, persist = true): { rubricVotes: JudgeRubricVote[]; allVoted: boolean; winnerId?: string; scores?: Record<string, number> } | { error: string } {
    if (this.isRecoveryPaused(battleId)) return { error: "La batalla está pausada para recuperación" };
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle) return { error: "Batalla no encontrada" };
    if (!battle.judges.find(j => j.id === judgeId)) return { error: "No eres juez" };
    if ((battle.status !== "in_progress" && battle.status !== "replica") || battle.roundPhase !== "voting") return { error: "La batalla no está en fase de votación" };
    if (round !== battle.currentRound) return { error: "La ronda no coincide con la batalla" };
    if (mc1Id !== battle.participants[0]?.userId || mc2Id !== battle.participants[1]?.userId) return { error: "Participantes inválidos" };
    if (!isValidRubric(mc1Scores) || !isValidRubric(mc2Scores)) return { error: "Las puntuaciones deben ser enteros entre 0 y 10" };

    const voteKey = this.roundVoteKey(battle, round);
    const existing = this.rubricVotes.get(voteKey) || [];
    const idx = existing.findIndex(v => v.judgeId === judgeId);
    const judgeUser = this.findUserById(judgeId);
    const judgeIdentity = judgeUser?.identities.get("judge");
    const vote: JudgeRubricVote = {
      judgeId, judgeName: judgeIdentity?.alias || judgeId.slice(0, 8), round,
      mc1Id, mc2Id, mc1Scores, mc2Scores,
    };
    if (idx >= 0) existing[idx] = vote;
    else existing.push(vote);
    this.rubricVotes.set(voteKey, existing);
    if (persist) this.runPersistence(battleId, this.persistence.saveRubricVote(battleId, vote, battle.replicaCount));

    const allVoted = battle.judges.every(j => existing.some(v => v.judgeId === j.id));
    let winnerIdResult: string | undefined;
    let scoresResult: Record<string, number> | undefined;

    if (allVoted) {
      const result = calculateRubricResult(existing);
      winnerIdResult = result.winnerId;
      scoresResult = result.scores;
    }

    return { rubricVotes: existing, allVoted, winnerId: winnerIdResult, scores: scoresResult };
  }

  async submitRubricVoteDurably(...args: Parameters<BattleRoomManager["submitRubricVote"]>): Promise<ReturnType<BattleRoomManager["submitRubricVote"]>> {
    const [battleId, judgeId, round, mc1Id, mc2Id, mc1Scores, mc2Scores] = args;
    const result = this.submitRubricVote(battleId, judgeId, round, mc1Id, mc2Id, mc1Scores, mc2Scores, false);
    if ("rubricVotes" in result) {
      const battle = this.battles.get(battleId.toLowerCase())!;
      const vote = result.rubricVotes.find(item => item.judgeId === judgeId)!;
      await this.persistence.saveRubricVote(battleId, vote, battle.replicaCount);
    }
    return result;
  }

  setMode(socketId: string, mode: BattleModeConfig): Battle | null {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || battle.status !== "lobby" || !this.isAdmin(socketId, battle)) return null;
    if (mode.rounds < 1 || mode.rounds > 5) return null;
    if (mode.timerMode === "manual" && (mode.entriesPerParticipant < 2 || mode.entriesPerParticipant > 6)) return null;
    if (mode.timerMode === "countdown" && ![60, 120].includes(mode.timePerTurn)) return null;
    battle.mode = {
      ...getDefaultModeConfig(mode.mode),
      ...mode,
      showScoresToSpectators: true,
      turnStructure: mode.timerMode === "manual" ? "one_way" : mode.turnStructure,
      liveControlEnabled: mode.liveControlEnabled ?? true,
      format: mode.format ?? battle.mode.format,
    };
    this.syncBattleToDb(battle);
    return battle;
  }

  setReplicaConfig(socketId: string, config: ReplicaConfig): Battle | null {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || battle.status !== "lobby" || !this.isAdmin(socketId, battle)) return null;
    if (config.maxReplicas < 1 || config.tieRange < 0) return null;
    battle.replicaConfig = { ...config, mode: { ...config.mode } };
    this.syncBattleToDb(battle);
    return battle;
  }

  transferHost(socketId: string, targetUserId: string): Battle | null {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || !this.canControlBattle(socketId, battle)) return null;

    const targetSocket = this.findUserById(targetUserId);
    if (!targetSocket || targetSocket.battleId !== battle.id) return null;

    this.assignHost(battle, targetSocket);
    this.syncMembers(battle);
    this.syncBattleToDb(battle);
    return battle;
  }

  changeRole(socketId: string, targetUserId: string, newRole: UserRole): Battle | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (!battle) return { error: "No estás en ninguna batalla" };
    if (battle.status !== "lobby") return { error: "Solo se pueden cambiar roles en el lobby" };
    if (!this.isAdmin(socketId, battle)) return { error: "Solo el admin puede cambiar roles" };

    const targetSocket = this.findUserById(targetUserId);
    if (!targetSocket || targetSocket.battleId !== battle.id) return { error: "Usuario no encontrado en esta sala" };

    if (newRole === "admin") return { error: "Usa la acción de administración correspondiente" };

    const oldRoles = [...targetSocket.identities.entries()]
      .filter(([role]) => role !== newRole
        && role !== "admin"
        && !(newRole === "host" && role === "judge")
        && !(newRole === "judge" && role === "host"))
      .map(([role]) => role);

    if (oldRoles.length === 0 && targetSocket.identities.has(newRole)) {
      return { error: "El usuario ya tiene ese rol" };
    }

    if (!targetSocket.identities.has(newRole)) {
      const currentCount = this.countRoleInBattle(battle, newRole);
      if (!canJoinAsRole(currentCount, newRole)) return { error: `El límite de ${newRole} ya fue alcanzado` };
    }

    for (const role of oldRoles) {
      this.removeRoleFromBattle(battle, targetSocket, role);
      targetSocket.identities.delete(role);
    }
    const identity = targetSocket.identities.get(newRole)
      ?? targetSocket.identities.get("admin")
      ?? [...targetSocket.identities.values()][0]
      ?? targetSocket.identity;
    if (!targetSocket.identities.has(newRole)) {
      if (newRole === "host") this.assignHost(battle, targetSocket);
      else {
        targetSocket.identities.set(newRole, identity);
        this.addRoleToBattle(battle, targetSocket, newRole, identity);
      }
    }

    this.syncSessionRoles(targetSocket);
    this.syncMembers(battle);
    this.syncBattleToDb(battle);

    return battle;
  }

  revokeRole(socketId: string, targetUserId: string, role: UserRole): Battle | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (!battle) return { error: "No estás en ninguna batalla" };
    if (battle.status !== "lobby") return { error: "Solo se pueden cambiar roles en el lobby" };
    if (!this.isAdmin(socketId, battle)) return { error: "Solo el admin puede cambiar roles" };
    if (role === "admin") return { error: "Usa la acción de administración correspondiente" };
    const target = this.findUserById(targetUserId);
    if (!target || target.battleId !== battle.id || !target.identities.has(role)) return { error: "El usuario no tiene ese rol" };
    this.removeRoleFromBattle(battle, target, role);
    target.identities.delete(role);
    this.syncSessionRoles(target);
    this.syncMembers(battle);
    this.syncBattleToDb(battle);
    return battle;
  }

  grantAdmin(socketId: string, targetUserId: string): Battle | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || !this.isAdmin(socketId, battle)) return { error: "Solo el admin puede otorgar administración" };
    if (battle.status !== "lobby") return { error: "Solo se puede cambiar la administración en el lobby" };
    const target = this.findUserById(targetUserId);
    if (!target || target.battleId !== battle.id) return { error: "Usuario no encontrado en esta sala" };
    if (target.identities.has("admin")) return { error: "El usuario ya es admin" };
    const admins = this.battleAdmins.get(battle.id);
    if (!admins || admins.size >= ROLE_LIMITS.admin) return { error: "La sala ya tiene el máximo de admins" };
    target.identities.set("admin", target.identity);
    admins.add(targetUserId);
    battle.adminId ??= targetUserId;
    this.syncSessionRoles(target);
    this.syncMembers(battle);
    this.syncBattleToDb(battle);
    return battle;
  }

  transferAdmin(socketId: string, targetUserId: string): Battle | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || !this.isAdmin(socketId, battle)) return { error: "Solo el admin puede transferir la administración" };
    if (battle.status !== "lobby") return { error: "Solo se puede transferir la administración en el lobby" };
    const source = this.sockets.get(socketId);
    const target = this.findUserById(targetUserId);
    if (!source || !target || target.battleId !== battle.id) return { error: "Usuario no encontrado en esta sala" };
    if (source.identity.userId === targetUserId) return { error: "Ya eres el admin de la sala" };
    const admins = this.battleAdmins.get(battle.id);
    if (!admins) return { error: "No se encontró la administración de la sala" };
    target.identities.set("admin", target.identity);
    admins.add(targetUserId);
    source.identities.delete("admin");
    admins.delete(source.identity.userId);
    battle.adminId = targetUserId;
    this.syncSessionRoles(source);
    this.syncSessionRoles(target);
    this.syncMembers(battle);
    this.syncBattleToDb(battle);
    return battle;
  }

  revokeAdmin(socketId: string, targetUserId: string): Battle | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || !this.isAdmin(socketId, battle)) return { error: "Solo el admin puede revocar administración" };
    if (battle.status !== "lobby") return { error: "Solo se puede cambiar la administración en el lobby" };
    const target = this.findUserById(targetUserId);
    const admins = this.battleAdmins.get(battle.id);
    if (!target || !admins?.has(targetUserId)) return { error: "El usuario no es admin" };
    if (admins.size <= 1) return { error: "La sala debe conservar al menos un admin" };
    target.identities.delete("admin");
    admins.delete(targetUserId);
    if (battle.adminId === targetUserId) battle.adminId = [...admins][0];
    this.syncSessionRoles(target);
    this.syncMembers(battle);
    this.syncBattleToDb(battle);
    return battle;
  }

  completeEntry(socketId: string, persist = true): { battle: Battle; shouldAdvance: boolean } | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (battle && this.isRecoveryPaused(battle.id)) return { error: "La batalla está pausada para recuperación" };
    if (!battle || !this.canControlBattle(socketId, battle)) return { error: "No tienes permiso para completar entradas" };
    if (!battle.mode.liveControlEnabled) return { error: "El control en vivo está desactivado" };
    if (battle.mode.timerMode !== "manual") return { error: "La batalla no usa entradas manuales" };
    if (battle.roundPhase !== "mc1_turn" && battle.roundPhase !== "mc2_turn") return { error: "No hay una entrada activa" };

    const participantId = battle.currentTurn;
    const remaining = battle.entriesRemaining[participantId] ?? battle.mode.entriesPerParticipant;
    battle.entriesRemaining[participantId] = Math.max(0, remaining - 1);
    if (battle.mode.votingSystem === "patron") {
      battle.pendingEntry = {
        mcId: participantId,
        entryIndex: battle.mode.entriesPerParticipant - battle.entriesRemaining[participantId] - 1,
      };
      battle.roundPhase = "entry_voting";
      this.refreshPhaseClock(battle);
      if (persist) this.syncBattleToDb(battle);
      return { battle, shouldAdvance: false };
    }
    if (persist) this.syncBattleToDb(battle);
    return { battle, shouldAdvance: battle.entriesRemaining[participantId] === 0 };
  }

  async completeEntryDurably(socketId: string): Promise<ReturnType<BattleRoomManager["completeEntry"]>> {
    const result = this.completeEntry(socketId, false);
    if ("battle" in result) await this.persistence.update(result.battle);
    return result;
  }

  submitPatronEntryVote(battleId: string, judgeId: string, points: number, persist = true): { battle: Battle; allVoted: boolean } | { error: string } {
    if (this.isRecoveryPaused(battleId)) return { error: "La batalla está pausada para recuperación" };
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle || battle.mode.votingSystem !== "patron" || battle.roundPhase !== "entry_voting" || !battle.pendingEntry) {
      return { error: "No hay una entrada pendiente de votación" };
    }
    if (!battle.judges.some(judge => judge.id === judgeId)) return { error: "No eres juez" };
    if (!Number.isInteger(points) || points < 0 || points > 4) return { error: "El puntaje debe ser un entero entre 0 y 4" };

    const pendingEntry = battle.pendingEntry;
    const voteKey = `${this.roundVoteKey(battle)}:${pendingEntry.mcId}:${pendingEntry.entryIndex}`;
    const votes = this.patronEntryVotes.get(voteKey) ?? [];
    const judgeIdentity = this.findUserById(judgeId)?.identities.get("judge");
    const vote: PatronEntryVote = {
      judgeId,
      judgeName: judgeIdentity?.alias ?? judgeId.slice(0, 8),
      round: battle.currentRound,
      entryIndex: pendingEntry.entryIndex,
      mcId: pendingEntry.mcId,
      points,
    };
    const existingIndex = votes.findIndex(existing => existing.judgeId === judgeId);
    if (existingIndex >= 0) votes[existingIndex] = vote;
    else votes.push(vote);
    this.patronEntryVotes.set(voteKey, votes);
    if (persist) this.runPersistence(battleId, this.persistence.savePatronEntryVote(battleId, voteKey, vote, battle.replicaCount));

    const allVoted = battle.judges.every(judge => votes.some(existing => existing.judgeId === judge.id));
    if (allVoted) {
      const isMc1 = battle.participants[0]?.userId === pendingEntry.mcId;
      const hasEntries = battle.entriesRemaining[pendingEntry.mcId] > 0;
      battle.pendingEntry = undefined;
      if (hasEntries) battle.roundPhase = isMc1 ? "mc1_turn" : "mc2_turn";
      else {
        battle.currentTurn = "";
        battle.roundPhase = isMc1 ? "pause" : "voting";
      }
      this.refreshPhaseClock(battle);
      if (persist) this.syncBattleToDb(battle);
    }
    return { battle, allVoted };
  }

  async submitPatronEntryVoteDurably(battleId: string, judgeId: string, points: number): Promise<ReturnType<BattleRoomManager["submitPatronEntryVote"]>> {
    const battle = this.battles.get(battleId.toLowerCase());
    const pending = battle?.pendingEntry;
    const key = battle && pending ? `${this.roundVoteKey(battle)}:${pending.mcId}:${pending.entryIndex}` : undefined;
    const result = this.submitPatronEntryVote(battleId, judgeId, points, false);
    if ("battle" in result && key) {
      const vote = this.patronEntryVotes.get(key)?.find(item => item.judgeId === judgeId);
      if (!vote) throw new Error("No se encontró el voto de entrada");
      await this.persistence.commitPatronEntryVote(result.battle, vote);
    }
    return result;
  }

  submitPatronExtraVote(battleId: string, judgeId: string, mc1Extra: number, mc2Extra: number, persist = true): { battle: Battle; allVoted: boolean } | { error: string } {
    if (this.isRecoveryPaused(battleId)) return { error: "La batalla está pausada para recuperación" };
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle || battle.mode.votingSystem !== "patron" || battle.roundPhase !== "voting") return { error: "No corresponde votar puntos extra" };
    if (!battle.judges.some(judge => judge.id === judgeId)) return { error: "No eres juez" };
    if (![mc1Extra, mc2Extra].every(value => Number.isInteger(value) && value >= 0 && value <= 4)) return { error: "Los extras deben ser enteros entre 0 y 4" };
    const [mc1, mc2] = battle.participants;
    if (!mc1 || !mc2) return { error: "Faltan participantes" };

    const voteKey = this.roundVoteKey(battle);
    const votes = this.patronExtraVotes.get(voteKey) ?? [];
    const judgeIdentity = this.findUserById(judgeId)?.identities.get("judge");
    const vote: PatronExtraVote = {
      judgeId,
      judgeName: judgeIdentity?.alias ?? judgeId.slice(0, 8),
      round: battle.currentRound,
      mc1Id: mc1.userId,
      mc2Id: mc2.userId,
      mc1Extra,
      mc2Extra,
    };
    const existingIndex = votes.findIndex(existing => existing.judgeId === judgeId);
    if (existingIndex >= 0) votes[existingIndex] = vote;
    else votes.push(vote);
    this.patronExtraVotes.set(voteKey, votes);
    if (persist) this.runPersistence(battleId, this.persistence.savePatronExtraVote(battleId, vote, battle.replicaCount));
    return { battle, allVoted: battle.judges.every(judge => votes.some(existing => existing.judgeId === judge.id)) };
  }

  async submitPatronExtraVoteDurably(battleId: string, judgeId: string, mc1Extra: number, mc2Extra: number): Promise<ReturnType<BattleRoomManager["submitPatronExtraVote"]>> {
    const result = this.submitPatronExtraVote(battleId, judgeId, mc1Extra, mc2Extra, false);
    if ("battle" in result) {
      const vote = this.patronExtraVotes.get(this.roundVoteKey(result.battle))?.find(item => item.judgeId === judgeId);
      if (!vote) throw new Error("No se encontró el voto extra");
      await this.persistence.savePatronExtraVote(battleId, vote, result.battle.replicaCount);
    }
    return result;
  }

  submitFreeVote(battleId: string, judgeId: string, votedForId: string): { battle: Battle; allVoted: boolean } | { error: string } {
    if (this.isRecoveryPaused(battleId)) return { error: "La batalla está pausada para recuperación" };
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle || battle.mode.votingSystem !== "free_vote" || battle.roundPhase !== "voting") {
      return { error: "No corresponde votar con voto libre" };
    }
    if (!battle.judges.some(judge => judge.id === judgeId)) return { error: "No eres juez" };

    const [mc1, mc2] = battle.participants;
    if (!mc1 || !mc2) return { error: "Faltan participantes" };
    if (votedForId !== mc1.userId && votedForId !== mc2.userId) return { error: "El voto debe ser para uno de los participantes" };

    const voteKey = this.roundVoteKey(battle);
    const votes = this.freeVotes.get(voteKey) ?? [];
    const judgeIdentity = this.findUserById(judgeId)?.identities.get("judge");
    const vote: FreeVote = {
      judgeId,
      judgeName: judgeIdentity?.alias ?? judgeId.slice(0, 8),
      round: battle.currentRound,
      mc1Id: mc1.userId,
      mc2Id: mc2.userId,
      votedForId,
    };
    const existingIndex = votes.findIndex(existing => existing.judgeId === judgeId);
    if (existingIndex >= 0) votes[existingIndex] = vote;
    else votes.push(vote);
    this.freeVotes.set(voteKey, votes);

    return { battle, allVoted: battle.judges.every(judge => votes.some(existing => existing.judgeId === judge.id)) };
  }

  async submitFreeVoteDurably(battleId: string, judgeId: string, votedForId: string): Promise<ReturnType<BattleRoomManager["submitFreeVote"]>> {
    const result = this.submitFreeVote(battleId, judgeId, votedForId);
    if ("battle" in result) {
      const vote = this.freeVotes.get(this.roundVoteKey(result.battle))?.find(item => item.judgeId === judgeId);
      if (!vote) throw new Error("No se encontró el voto libre");
      await this.persistence.saveFreeVote(battleId, vote, result.battle.replicaCount);
    }
    return result;
  }

  submitRoomVote(socketId: string, battleId: string, votedForId: string): { battle: Battle; allVoted: boolean } | { error: string } {
    if (this.isRecoveryPaused(battleId)) return { error: "La batalla está pausada para recuperación" };
    const battle = this.findBattleBySocket(socketId);
    if (!battle || battle.id !== battleId.toLowerCase() || battle.mode.votingSystem !== "room_vote" || battle.roundPhase !== "voting") {
      return { error: "No corresponde votar con voto de sala" };
    }
    const voter = this.sockets.get(socketId);
    if (!voter || voter.identities.size === 0) return { error: "Necesitas un rol asignado para votar" };
    const [mc1, mc2] = battle.participants;
    if (!mc1 || !mc2) return { error: "Faltan participantes" };
    if (voter.identity.userId === mc1.userId || voter.identity.userId === mc2.userId) {
      return { error: "Los MC de esta batalla no pueden votar" };
    }
    const voteKey = this.roomVoteKey(battle);
    const roster = this.roomVotingRosters.get(voteKey);
    if (!roster?.has(voter.identity.userId)) return { error: "No formas parte del padrón de votación" };
    if (votedForId !== mc1.userId && votedForId !== mc2.userId) return { error: "El voto debe ser para uno de los participantes" };

    const votes = this.roomVotes.get(voteKey) ?? [];
    const vote: RoomVote = {
      voterId: voter.identity.userId,
      voterName: voter.identity.alias,
      round: battle.currentRound,
      mc1Id: mc1.userId,
      mc2Id: mc2.userId,
      votedForId,
    };
    const existingIndex = votes.findIndex(existing => existing.voterId === vote.voterId);
    if (existingIndex >= 0) votes[existingIndex] = vote;
    else votes.push(vote);
    this.roomVotes.set(voteKey, votes);
    return { battle, allVoted: this.isRoomVoteComplete(battle.id) };
  }

  async submitRoomVoteDurably(socketId: string, battleId: string, votedForId: string): Promise<ReturnType<BattleRoomManager["submitRoomVote"]>> {
    const result = this.submitRoomVote(socketId, battleId, votedForId);
    if ("battle" in result) {
      const userId = this.sockets.get(socketId)?.identity.userId;
      const vote = this.roomVotes.get(this.roomVoteKey(result.battle))?.find(item => item.voterId === userId);
      if (!vote) throw new Error("No se encontró el voto de sala");
      await this.persistence.saveRoomVote(battleId, vote, result.battle.replicaCount);
    }
    return result;
  }

  isRoomVoteComplete(battleId: string): boolean {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle || battle.mode.votingSystem !== "room_vote" || battle.roundPhase !== "voting") return false;
    const voteKey = this.roomVoteKey(battle);
    const roster = this.roomVotingRosters.get(voteKey);
    const connectedVoters = battle.members
      .filter(member => member.connected && member.roles.length > 0 && roster?.has(member.userId))
      .map(member => member.userId);
    const votes = this.roomVotes.get(voteKey) ?? [];
    return connectedVoters.length > 0 && connectedVoters.every(userId => votes.some(vote => vote.voterId === userId));
  }

  isVotingComplete(battleId: string): boolean {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle || battle.roundPhase !== "voting" || this.isRecoveryPaused(battleId)) return false;
    if (battle.mode.votingSystem === "room_vote") return this.isRoomVoteComplete(battleId);
    const key = this.roundVoteKey(battle);
    const votes = battle.mode.votingSystem === "rubrica" ? this.rubricVotes.get(key) : battle.mode.votingSystem === "patron" ? this.patronExtraVotes.get(key) : this.freeVotes.get(key);
    return battle.judges.length > 0 && battle.judges.every(judge => votes?.some(vote => vote.judgeId === judge.id));
  }

  listBattles(): Battle[] { return Array.from(this.battles.values()); }

  isRecoveryPaused(battleId: string): boolean { return this.recoveryPaused.has(battleId.toLowerCase()); }

  private recoveryIssue(battle: Battle): string | undefined {
    const [mc1, mc2] = battle.participants;
    if (!battle.phaseToken || !mc1 || !mc2 || mc1.userId === mc2.userId) return "Esta partida tiene datos históricos incompletos y necesita revisión antes de reanudarse.";
    const key = this.roundVoteKey(battle);
    const ids = new Set([mc1.userId, mc2.userId]);
    const judges = new Set(battle.judges.map(judge => judge.id));
    if (battle.mode.votingSystem !== "room_vote" && !VALID_JUDGE_COUNTS.has(judges.size)) return "La mesa de jueces guardada está incompleta.";
    if (battle.roundPhase === "mc1_turn" || battle.roundPhase === "mc2_turn") {
      if (battle.currentTurn !== (battle.roundPhase === "mc1_turn" ? mc1.userId : mc2.userId)) return "El turno guardado no coincide con los participantes.";
    }
    if (battle.roundPhase === "entry_voting" && (!battle.pendingEntry || !ids.has(battle.pendingEntry.mcId))) return "La entrada pendiente está incompleta.";
    if (battle.roundPhase === "round_result" && !battle.roundResults.some(result => result.round === battle.currentRound && (result.replica ?? 0) === battle.replicaCount)) return "Falta el resultado guardado de esta ronda.";
    if ((this.rubricVotes.get(key) ?? []).some(vote => !judges.has(vote.judgeId) || vote.mc1Id !== mc1.userId || vote.mc2Id !== mc2.userId || !isValidRubric(vote.mc1Scores) || !isValidRubric(vote.mc2Scores))) return "Los votos guardados no coinciden con esta partida.";
    if ((this.freeVotes.get(key) ?? []).some(vote => !judges.has(vote.judgeId) || vote.mc1Id !== mc1.userId || vote.mc2Id !== mc2.userId || !ids.has(vote.votedForId))) return "Los votos libres guardados son inconsistentes.";
    if ((this.patronExtraVotes.get(key) ?? []).some(vote => !judges.has(vote.judgeId) || vote.mc1Id !== mc1.userId || vote.mc2Id !== mc2.userId || ![vote.mc1Extra, vote.mc2Extra].every(points => Number.isInteger(points) && points >= 0 && points <= 4))) return "Los votos extra guardados son inconsistentes.";
    for (const [entryKey, votes] of this.patronEntryVotes) {
      if (entryKey.startsWith(`${key}:`) && votes.some(vote => !judges.has(vote.judgeId) || !ids.has(vote.mcId) || !Number.isInteger(vote.points) || vote.points < 0 || vote.points > 4)) return "Los votos de entrada guardados son inconsistentes.";
    }
    if (battle.mode.votingSystem === "room_vote" && (battle.roundPhase === "voting" || battle.roundPhase === "round_result")) {
      const roster = this.roomVotingRosters.get(key);
      if (!roster || roster.size === 0 || [...roster].some(id => ids.has(id) || !battle.members.some(member => member.userId === id))) return "Falta un padrón de votación válido para esta ronda.";
      if ((this.roomVotes.get(key) ?? []).some(vote => !roster.has(vote.voterId) || vote.mc1Id !== mc1.userId || vote.mc2Id !== mc2.userId || !ids.has(vote.votedForId))) return "Los votos de sala no coinciden con el padrón.";
    }
    return undefined;
  }

  async resumeBattleDurably(socketId: string, action: "continue" | "restart_clock"): Promise<{ battle: Battle } | { error: string }> {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || !this.canControlBattle(socketId, battle)) return { error: "Solo el organizador puede reanudar la batalla" };
    if (!this.isRecoveryPaused(battle.id)) return { error: "La batalla no está pausada para recuperación" };
    const issue = this.recoveryIssue(battle);
    if (issue) return { error: issue };
    const required = new Set([...battle.participants.map(mc => mc.userId), ...battle.judges.map(judge => judge.id), ...(battle.mode.votingSystem === "room_vote" && battle.roundPhase === "voting" ? this.roomVotingRosters.get(this.roomVoteKey(battle)) ?? [] : [])]);
    if ([...required].some(id => !battle.members.some(member => member.userId === id && member.connected))) return { error: "Espera a que vuelvan los MC, los jueces y los miembros del padrón antes de reanudar" };
    const timing = this.getPhaseTiming(battle.id)!;
    if (action === "continue" && (timing.state === "expired" || timing.state === "unknown")) return { error: "El plazo venció o es desconocido. Elige reiniciar el reloj de esta fase." };
    if (action !== "continue" && action !== "restart_clock") return { error: "Decisión de recuperación inválida" };
    const previous = { phaseDeadline: battle.phaseDeadline, phaseToken: battle.phaseToken, timeRemaining: battle.timeRemaining };
    if (action === "restart_clock") this.refreshPhaseClock(battle);
    else {
      battle.phaseToken = randomBytes(16).toString("hex");
      battle.timeRemaining = timing.timeRemaining ?? 0;
      this.phaseTokens.set(battle.id, battle.phaseToken);
    }
    try { await this.persistence.update(battle); }
    catch (error) { Object.assign(battle, previous); this.phaseTokens.set(battle.id, previous.phaseToken!); throw error; }
    this.recoveryPaused.delete(battle.id);
    delete battle.recovery;
    return { battle };
  }

  async loadActiveBattlesFromDb(): Promise<void> {
    const battles = await this.persistence.loadActiveBattles();
    for (const battle of battles) {
      await this.restoreMembers(battle);
      if (battle.status === "lobby") continue;
      this.recoveryPaused.add(battle.id);
      const key = this.roundVoteKey(battle);
      const [rubric, entries, extras, free, room, roster] = await Promise.all([
        this.persistence.getRubricVotes(battle.id, battle.currentRound, battle.replicaCount),
        this.persistence.getPatronEntryVotes(battle.id, battle.currentRound, battle.replicaCount),
        this.persistence.getPatronExtraVotes(battle.id, battle.currentRound, battle.replicaCount),
        this.persistence.getFreeVotes(battle.id, battle.currentRound, battle.replicaCount),
        this.persistence.getRoomVotes(battle.id, battle.currentRound, battle.replicaCount),
        this.persistence.getRoomVotingRoster(battle.id, battle.currentRound, battle.replicaCount),
      ]);
      this.rubricVotes.set(key, rubric);
      this.patronExtraVotes.set(key, extras);
      this.freeVotes.set(key, free);
      this.roomVotes.set(key, room);
      if (roster) this.roomVotingRosters.set(key, new Set(roster));
      for (const vote of entries) {
        const entryKey = `${key}:${vote.mcId}:${vote.entryIndex}`;
        const votes = this.patronEntryVotes.get(entryKey) ?? [];
        votes.push(vote);
        this.patronEntryVotes.set(entryKey, votes);
      }
      this.phaseTokens.set(battle.id, battle.phaseToken ?? randomBytes(16).toString("hex"));
      battle.recovery = { paused: true, issue: this.recoveryIssue(battle) };
      battle.timeRemaining = this.getPhaseTiming(battle.id)?.timeRemaining ?? 0;
    }
    console.log(`📦 ${battles.length} batallas activas restauradas desde BD`);
  }

  findBattleBySocket(socketId: string): Battle | null {
    const user = this.sockets.get(socketId);
    if (!user) return null;
    return this.battles.get(user.battleId) ?? null;
  }

  getSocketIdentity(socketId: string, role: UserRole): SocketIdentity | undefined {
    return this.sockets.get(socketId)?.identities.get(role);
  }

  getSocketIdentityForBattle(socketId: string, role: UserRole, battleId: unknown): SocketIdentity | undefined {
    if (typeof battleId !== "string") return undefined;
    const socket = this.sockets.get(socketId);
    return socket?.battleId === battleId.toLowerCase() ? socket.identities.get(role) : undefined;
  }

  getSocketMember(socketId: string): { userId: string; roles: UserRole[] } | undefined {
    const user = this.sockets.get(socketId);
    if (!user) return undefined;
    return { userId: user.identity.userId, roles: [...user.identities.keys()] };
  }

  private findUserById(userId: string): SocketUser | undefined {
    for (const user of this.sockets.values()) {
      if (user.identity.userId === userId) return user;
    }
    return undefined;
  }

  private sanitizeAlias(alias: string): string {
    return alias.trim().replace(/\s+/g, " ").slice(0, 40);
  }

  private syncSessionRoles(user: SocketUser): void {
    const session = this.sessions.get(user.sessionId);
    if (!session) return;
    session.identity = user.identity;
    session.identities = new Map(user.identities);
  }

  private syncMembers(battle: Battle): void {
    const connectedMembers = [...this.sessions.values()]
      .filter(session => session.battleId === battle.id)
      .map(session => ({
        userId: session.identity.userId,
        alias: session.identity.alias,
        roles: [...session.identities.keys()],
        connected: session.connected,
      }))
      .filter((member, index, all) => all.findIndex(candidate => candidate.userId === member.userId) === index);
    const onlineIds = new Set(connectedMembers.map(member => member.userId));
    battle.members = [...connectedMembers, ...[...(this.offlineMembers.get(battle.id)?.values() ?? [])].filter(member => !onlineIds.has(member.userId))];
  }

  private roomVoteKey(battle: Battle): string {
    return this.roundVoteKey(battle);
  }

  private roundVoteKey(battle: Battle, round = battle.currentRound): string {
    return `${battle.id}:${battle.replicaCount}:${round}`;
  }

  private lockRoomVotingRoster(battle: Battle): void {
    const participantIds = new Set(battle.participants.map(participant => participant.userId));
    const eligibleIds = battle.members
      .filter(member => member.connected && member.roles.length > 0 && !participantIds.has(member.userId))
      .map(member => member.userId);
    this.roomVotingRosters.set(this.roomVoteKey(battle), new Set(eligibleIds));
  }

  private assignHost(battle: Battle, target: SocketUser): void {
    for (const user of this.sockets.values()) {
      if (user.battleId !== battle.id || user === target || !user.identities.has("host")) continue;
      user.identities.delete("host");
      this.syncSessionRoles(user);
    }
    target.identities.set("host", target.identity);
    battle.hostId = target.identity.userId;
    this.syncSessionRoles(target);
  }

  private isAdmin(socketId: string, battle: Battle): boolean {
    const adminId = this.getSocketIdentity(socketId, "admin")?.userId;
    if (!adminId) return false;
    return this.battleAdmins.get(battle.id)?.has(adminId) ?? false;
  }

  private addRoleToBattle(battle: Battle, socketUser: SocketUser, role: UserRole, identity: SocketIdentity): void {
    switch (role) {
      case "participant": {
        if (!battle.participants.find(p => p.userId === identity.userId)) {
          battle.participants.push({ userId: identity.userId, name: identity.name, alias: identity.alias, isActive: false, currentScore: 0, roundsWon: 0 });
          this.runPersistence(battle.id, this.persistence.addParticipant(battle.id, { userId: identity.userId, name: identity.name, alias: identity.alias, isActive: false, currentScore: 0, roundsWon: 0 }));
        }
        break;
      }
      case "judge": {
        if (!battle.judges.find(j => j.id === identity.userId)) {
          battle.judges.push({ id: identity.userId, alias: identity.alias });
          this.runPersistence(battle.id, this.persistence.addJudge(battle.id, { id: identity.userId, alias: identity.alias }));
        }
        break;
      }
      case "spectator": {
        if (!battle.spectators.find(s => s.id === identity.userId)) {
          battle.spectators.push({ id: identity.userId, alias: identity.alias });
          this.runPersistence(battle.id, this.persistence.addSpectator(battle.id, { id: identity.userId, alias: identity.alias }));
        }
        break;
      }
      case "host": {
        battle.hostId = identity.userId;
        break;
      }
      case "admin": {
        const admins = this.battleAdmins.get(battle.id);
        if (admins) admins.add(identity.userId);
        break;
      }
    }
  }

  private removeRoleFromBattle(battle: Battle, socketUser: SocketUser, role: UserRole): void {
    const identity = socketUser.identities.get(role);
    if (!identity) return;
    switch (role) {
      case "participant": {
        battle.participants = battle.participants.filter(p => p.userId !== identity.userId);
        this.runPersistence(battle.id, this.persistence.removeParticipant(battle.id, identity.userId));
        break;
      }
      case "judge": {
        battle.judges = battle.judges.filter(j => j.id !== identity.userId);
        this.runPersistence(battle.id, this.persistence.removeJudge(battle.id, identity.userId));
        break;
      }
      case "spectator": {
        battle.spectators = battle.spectators.filter(s => s.id !== identity.userId);
        this.runPersistence(battle.id, this.persistence.removeSpectator(battle.id, identity.userId));
        break;
      }
      case "host": {
        if (battle.hostId === identity.userId) battle.hostId = undefined;
        break;
      }
      case "admin": {
        const admins = this.battleAdmins.get(battle.id);
        if (admins) admins.delete(identity.userId);
        break;
      }
    }
  }

  private syncBattleToDb(battle: Battle): void {
    this.runPersistence(battle.id, this.persistence.update(battle));
  }

  canControlBattle(socketId: string, battle: Battle): boolean {
    const isHost = Boolean(battle.hostId && this.getSocketIdentity(socketId, "host")?.userId === battle.hostId);
    return this.isAdmin(socketId, battle) || isHost;
  }

  private addToTotalScores(battle: Battle, scores: Record<string, number>): void {
    for (const [participantId, score] of Object.entries(scores)) {
      battle.totalScores[participantId] = (battle.totalScores[participantId] ?? 0) + score;
    }
  }

  private getTurnSequence(battle: Battle): string[] {
    const [mc1, mc2] = battle.participants;
    if (!mc1 || !mc2) return [];
    if (battle.mode.timerMode === "countdown" && battle.mode.turnStructure === "round_trip") {
      return [mc1.userId, mc2.userId, mc2.userId, mc1.userId];
    }
    return [mc1.userId, mc2.userId];
  }

  private recordRoundResult(
    battle: Battle,
    scores: Record<string, number>,
    winnerId: string | undefined,
    judgeVotes: { judgeId: string; judgeName: string; votedForId?: string }[],
  ): void {
    battle.roundResults.push({ round: battle.currentRound, replica: battle.replicaCount, scores: { ...scores }, winnerId, judgeVotes });
  }

  private getPatronJudgeVotes(
    battle: Battle,
    entryVotes: PatronEntryVote[],
    extraVotes: PatronExtraVote[],
  ): { judgeId: string; judgeName: string; votedForId?: string }[] {
    const [mc1, mc2] = battle.participants;
    if (!mc1 || !mc2) return [];
    return battle.judges.map(judge => {
      const judgeEntries = entryVotes.filter(vote => vote.judgeId === judge.id);
      const extras = extraVotes.find(vote => vote.judgeId === judge.id);
      const mc1Score = judgeEntries.filter(vote => vote.mcId === mc1.userId).reduce((sum, vote) => sum + vote.points, 0) + (extras?.mc1Extra ?? 0);
      const mc2Score = judgeEntries.filter(vote => vote.mcId === mc2.userId).reduce((sum, vote) => sum + vote.points, 0) + (extras?.mc2Extra ?? 0);
      return {
        judgeId: judge.id,
        judgeName: extras?.judgeName ?? judgeEntries[0]?.judgeName ?? judge.alias,
        votedForId: mc1Score === mc2Score ? undefined : mc1Score > mc2Score ? mc1.userId : mc2.userId,
      };
    });
  }

  private shouldStartReplica(battle: Battle): boolean {
    const config = battle.replicaConfig;
    if (!config?.enabled || battle.replicaCount >= config.maxReplicas) return false;
    const [mc1, mc2] = battle.participants;
    if (!mc1 || !mc2) return false;
    const difference = Math.abs((battle.totalScores[mc1.userId] ?? 0) - (battle.totalScores[mc2.userId] ?? 0));
    return difference <= config.tieRange;
  }
}
