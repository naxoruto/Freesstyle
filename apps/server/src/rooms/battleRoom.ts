import { v4 as uuid } from "uuid";
import type { Battle, BattleModeConfig, Participant, ReplicaConfig, User, UserRole, JudgeRubricVote, PatronEntryVote, PatronExtraVote, Word, RoundPhase } from "@freestyle/shared";
import { generateWord } from "../words/wordGenerator";
import { getDefaultModeConfig } from "../modes/modes";
import { calculatePatronResult, calculateRubricResult, isValidRubric } from "../scoring/scoring";

interface SocketIdentity { userId: string; name: string; alias: string; }
interface SocketUser { socketId: string; battleId: string; identities: Map<UserRole, SocketIdentity>; }

export class BattleRoomManager {
  private battles = new Map<string, Battle>();
  private sockets = new Map<string, SocketUser>();
  private adminTokens = new Map<string, string>();
  private rubricVotes = new Map<string, JudgeRubricVote[]>(); // key: battleId:round
  private patronEntryVotes = new Map<string, PatronEntryVote[]>();
  private patronExtraVotes = new Map<string, PatronExtraVote[]>();
  private phaseTimers = new Map<string, NodeJS.Timeout>();
  // Track a unique token per phase transition to prevent duplicate advances
  private phaseTokens = new Map<string, string>();

  createBattle(mode?: Partial<BattleModeConfig>): Battle {
    const id = uuid().slice(0, 8);
    const modeName = mode?.mode ?? "clasico";
    const battleMode = { ...getDefaultModeConfig(modeName), ...mode, showScoresToSpectators: true };
    if (battleMode.timerMode === "countdown" && ![60, 120].includes(battleMode.timePerTurn)) battleMode.timePerTurn = 60;
    if (battleMode.timerMode === "manual") battleMode.turnStructure = "one_way";
    const battle: Battle = {
      id,
      mode: battleMode,
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
    };
    this.battles.set(id, battle);
    this.adminTokens.set(id, uuid());
    console.log(`🎮 Batalla creada: ${id} (modo: ${battle.mode.mode})`);
    return battle;
  }

  getAdminToken(battleId: string): string | undefined {
    return this.adminTokens.get(battleId.toLowerCase());
  }

  getJoinError(battleId: string, user: Pick<User, "id" | "role">, adminToken?: string): string | undefined {
    const normalizedId = battleId.toLowerCase();
    const battle = this.battles.get(normalizedId);
    if (!battle) return "Batalla no encontrada";
    if (user.role === "admin" && adminToken !== this.adminTokens.get(normalizedId)) return "Acceso de admin inválido";
    if (user.role === "judge" && !battle.judges.some(judge => judge.id === user.id) && battle.judges.length >= 5) return "La mesa de jueces ya tiene 5 integrantes";
    return undefined;
  }

  joinBattle(battleId: string, socketId: string, user: Pick<User, "id" | "name" | "alias" | "role">, adminToken?: string): Battle | null {
    const normalizedId = battleId.toLowerCase();
    const battle = this.battles.get(normalizedId);
    if (!battle || this.getJoinError(normalizedId, user, adminToken)) return null;

    const existingSocket = this.sockets.get(socketId);
    if (existingSocket && existingSocket.battleId !== normalizedId) return null;
    const socketUser = existingSocket ?? { socketId, battleId: normalizedId, identities: new Map<UserRole, SocketIdentity>() };
    socketUser.identities.set(user.role, { userId: user.id, name: user.name, alias: user.alias });
    this.sockets.set(socketId, socketUser);

    if (user.role === "admin") battle.adminId = user.id;

    if (user.role === "judge") {
      if (!battle.judges.find(j => j.id === user.id)) battle.judges.push({ id: user.id, alias: user.alias });
    }
    if (user.role === "participant") {
      const exists = battle.participants.find(p => p.userId === user.id);
      if (!exists) {
        battle.participants.push({ userId: user.id, name: user.name, alias: user.alias, isActive: false, currentScore: 0, roundsWon: 0 });
      }
    }
    if (user.role === "spectator") {
      if (!battle.spectators.find(s => s.id === user.id)) battle.spectators.push({ id: user.id, alias: user.alias });
    }
    return battle;
  }

  leaveRoom(socketId: string): Battle | null {
    const user = this.sockets.get(socketId);
    if (!user) return null;
    this.sockets.delete(socketId);
    const battle = this.battles.get(user.battleId);
    if (!battle) return null;
    const participantId = user.identities.get("participant")?.userId;
    const judgeId = user.identities.get("judge")?.userId;
    const spectatorId = user.identities.get("spectator")?.userId;
    if (participantId) battle.participants = battle.participants.filter(p => p.userId !== participantId);
    if (judgeId) battle.judges = battle.judges.filter(j => j.id !== judgeId);
    if (spectatorId) battle.spectators = battle.spectators.filter(s => s.id !== spectatorId);
    return battle;
  }

  startBattle(socketId: string): { battle: Battle } | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (!battle) return { error: "No estás en ninguna batalla" };
    if (!this.isAdmin(socketId, battle)) return { error: "Solo el admin puede iniciar la batalla" };
    if (battle.participants.length < 2) return { error: "Se necesitan al menos 2 participantes" };
    if (![1, 3, 5].includes(battle.judges.length)) return { error: "La mesa debe tener 1, 3 o 5 jueces" };

    battle.status = "in_progress";
    battle.currentRound = 1;
    battle.roundPhase = "countdown";
    battle.totalScores = {};
    battle.roundResults = [];
    battle.turnSequenceIndex = 0;
    battle.replicaCount = 0;
    battle.entriesRemaining = Object.fromEntries(
      battle.participants.slice(0, 2).map(participant => [participant.userId, battle.mode.entriesPerParticipant]),
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

    this.phaseTokens.set(battle.id, uuid().slice(0, 8));
    return { battle };
  }

  /**
   * Get the current phase token for a battle.
   * Clients should send this token with next_phase to prevent duplicate advances.
   */
  getPhaseToken(battleId: string): string | undefined {
    return this.phaseTokens.get(battleId.toLowerCase());
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
    const timer = setTimeout(() => {
      this.phaseTimers.delete(key);
      callback();
    }, ms);
    this.phaseTimers.set(key, timer);
  }

  // Avanzar a la siguiente fase de la ronda
  // `expectedToken` is used for idempotency: if provided and it doesn't match
  // the current phase token, the call is a duplicate and is rejected.
  nextPhase(battleId: string, expectedToken?: string): { battle: Battle; word?: Word; phase: RoundPhase; participantId?: string; timeRemaining?: number; phaseToken: string; rubricVotes?: JudgeRubricVote[]; scores?: Record<string, number> } | { error: string } {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle || (battle.status !== "in_progress" && battle.status !== "replica")) return { error: "Batalla no encontrada" };

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
        if (battle.mode.mode === "libre") {
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
          battle.roundPhase = "voting";
          battle.currentTurn = "";
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
        if (battle.mode.votingSystem === "patron") {
          const voteKey = `${battle.id}:${battle.currentRound}`;
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

        // Ya se votó, verificar si todos los jueces votaron con rúbrica
        const voteKey = `${battle.id}:${battle.currentRound}`;
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
              battle.participants.slice(0, 2).map(participant => [participant.userId, battle.mode.entriesPerParticipant]),
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
          battle.participants.slice(0, 2).map(participant => [participant.userId, battle.mode.entriesPerParticipant]),
        );
        return { battle, phase: "countdown", phaseToken: newToken };
      }
      default:
        return { error: "Fase desconocida" };
    }
  }

  submitRubricVote(battleId: string, judgeId: string, round: number, mc1Id: string, mc2Id: string, mc1Scores: { flow: number; lirica: number; ingenio: number; presencia: number; tecnica: number }, mc2Scores: { flow: number; lirica: number; ingenio: number; presencia: number; tecnica: number }): { rubricVotes: JudgeRubricVote[]; allVoted: boolean; winnerId?: string; scores?: Record<string, number> } | { error: string } {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle) return { error: "Batalla no encontrada" };
    if (!battle.judges.find(j => j.id === judgeId)) return { error: "No eres juez" };
    if ((battle.status !== "in_progress" && battle.status !== "replica") || battle.roundPhase !== "voting") return { error: "La batalla no está en fase de votación" };
    if (round !== battle.currentRound) return { error: "La ronda no coincide con la batalla" };
    if (mc1Id !== battle.participants[0]?.userId || mc2Id !== battle.participants[1]?.userId) return { error: "Participantes inválidos" };
    if (!isValidRubric(mc1Scores) || !isValidRubric(mc2Scores)) return { error: "Las puntuaciones deben ser enteros entre 0 y 10" };

    const voteKey = `${battle.id}:${round}`;
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
    };
    return battle;
  }

  setReplicaConfig(socketId: string, config: ReplicaConfig): Battle | null {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || battle.status !== "lobby" || !this.isAdmin(socketId, battle)) return null;
    if (config.maxReplicas < 1 || config.tieRange < 0) return null;
    battle.replicaConfig = { ...config, mode: { ...config.mode } };
    return battle;
  }

  transferHost(socketId: string, targetUserId: string): Battle | null {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || !this.canControlBattle(socketId, battle)) return null;

    let targetSocket: SocketUser | undefined;
    let targetIdentity: SocketIdentity | undefined;
    for (const socketUser of this.sockets.values()) {
      if (socketUser.battleId !== battle.id) continue;
      for (const identity of socketUser.identities.values()) {
        if (identity.userId === targetUserId) {
          targetSocket = socketUser;
          targetIdentity = identity;
          break;
        }
      }
      if (targetSocket) break;
    }
    if (!targetSocket || !targetIdentity) return null;

    for (const socketUser of this.sockets.values()) {
      if (socketUser.battleId === battle.id) socketUser.identities.delete("host");
    }
    targetSocket.identities.set("host", targetIdentity);
    battle.hostId = targetUserId;
    return battle;
  }

  completeEntry(socketId: string): { battle: Battle; shouldAdvance: boolean } | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || !this.canControlBattle(socketId, battle)) return { error: "No tienes permiso para completar entradas" };
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
      return { battle, shouldAdvance: false };
    }
    return { battle, shouldAdvance: battle.entriesRemaining[participantId] === 0 };
  }

  submitPatronEntryVote(battleId: string, judgeId: string, points: number): { battle: Battle; allVoted: boolean } | { error: string } {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle || battle.mode.votingSystem !== "patron" || battle.roundPhase !== "entry_voting" || !battle.pendingEntry) {
      return { error: "No hay una entrada pendiente de votación" };
    }
    if (!battle.judges.some(judge => judge.id === judgeId)) return { error: "No eres juez" };
    if (!Number.isInteger(points) || points < 0 || points > 4) return { error: "El puntaje debe ser un entero entre 0 y 4" };

    const pendingEntry = battle.pendingEntry;
    const voteKey = `${battle.id}:${battle.currentRound}:${pendingEntry.mcId}:${pendingEntry.entryIndex}`;
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
    }
    return { battle, allVoted };
  }

  submitPatronExtraVote(battleId: string, judgeId: string, mc1Extra: number, mc2Extra: number): { battle: Battle; allVoted: boolean } | { error: string } {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle || battle.mode.votingSystem !== "patron" || battle.roundPhase !== "voting") return { error: "No corresponde votar puntos extra" };
    if (!battle.judges.some(judge => judge.id === judgeId)) return { error: "No eres juez" };
    if (![mc1Extra, mc2Extra].every(value => Number.isInteger(value) && value >= 0 && value <= 4)) return { error: "Los extras deben ser enteros entre 0 y 4" };
    const [mc1, mc2] = battle.participants;
    if (!mc1 || !mc2) return { error: "Faltan participantes" };

    const voteKey = `${battle.id}:${battle.currentRound}`;
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
    return { battle, allVoted: battle.judges.every(judge => votes.some(existing => existing.judgeId === judge.id)) };
  }

  listBattles(): Battle[] { return Array.from(this.battles.values()); }

  findBattleBySocket(socketId: string): Battle | null {
    const user = this.sockets.get(socketId);
    if (!user) return null;
    return this.battles.get(user.battleId) ?? null;
  }

  getSocketIdentity(socketId: string, role: UserRole): SocketIdentity | undefined {
    return this.sockets.get(socketId)?.identities.get(role);
  }

  private findUserById(userId: string): SocketUser | undefined {
    for (const user of this.sockets.values()) {
      for (const identity of user.identities.values()) {
        if (identity.userId === userId) return user;
      }
    }
    return undefined;
  }

  private isAdmin(socketId: string, battle: Battle): boolean {
    return Boolean(battle.adminId && this.getSocketIdentity(socketId, "admin")?.userId === battle.adminId);
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
    battle.roundResults.push({ round: battle.currentRound, scores: { ...scores }, winnerId, judgeVotes });
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
