import { v4 as uuid } from "uuid";
import type { Battle, BattleModeConfig, Participant, User, JudgeRubricVote, Word, RoundPhase } from "@freestyle/shared";
import { generateWord } from "../words/wordGenerator";
import { getDefaultModeConfig } from "../modes/modes";

interface SocketUser { socketId: string; userId: string; name: string; alias: string; role: string; }

export class BattleRoomManager {
  private battles = new Map<string, Battle>();
  private sockets = new Map<string, SocketUser>();
  private rubricVotes = new Map<string, JudgeRubricVote[]>(); // key: battleId:round
  private phaseTimers = new Map<string, NodeJS.Timeout>();
  // Track a unique token per phase transition to prevent duplicate advances
  private phaseTokens = new Map<string, string>();

  createBattle(mode?: Partial<BattleModeConfig>): Battle {
    const id = uuid().slice(0, 8);
    const battle: Battle = {
      id,
      mode: mode?.mode ? { ...getDefaultModeConfig(mode.mode), ...mode } as BattleModeConfig : getDefaultModeConfig("clasico"),
      status: "lobby",
      participants: [],
      judges: [],
      currentRound: 0,
      roundPhase: "countdown",
      currentTurn: "",
      timeRemaining: 0,
      createdAt: new Date().toISOString(),
    };
    this.battles.set(id, battle);
    console.log(`🎮 Batalla creada: ${id} (modo: ${battle.mode.mode})`);
    return battle;
  }

  joinBattle(battleId: string, socketId: string, user: Pick<User, "id" | "name" | "alias" | "role">): Battle | null {
    const normalizedId = battleId.toLowerCase();
    const battle = this.battles.get(normalizedId);
    if (!battle) return null;

    this.sockets.set(socketId, { socketId, userId: user.id, name: user.name, alias: user.alias, role: user.role });

    if (user.role === "judge") {
      if (!battle.judges.find(j => j.id === user.id)) battle.judges.push({ id: user.id, alias: user.alias });
    }
    if (user.role === "participant") {
      const exists = battle.participants.find(p => p.userId === user.id);
      if (!exists) {
        battle.participants.push({ userId: user.id, name: user.name, alias: user.alias, isActive: false, currentScore: 0, roundsWon: 0 });
      }
    }
    return battle;
  }

  leaveRoom(socketId: string): Battle | null {
    const user = this.sockets.get(socketId);
    if (!user) return null;
    this.sockets.delete(socketId);
    for (const battle of this.battles.values()) {
      if (battle.participants.some(p => p.userId === user.userId)) {
        battle.participants = battle.participants.filter(p => p.userId !== user.userId);
        return battle;
      }
      if (battle.judges.some(j => j.id === user.userId)) {
        battle.judges = battle.judges.filter(j => j.id !== user.userId);
        return battle;
      }
    }
    return null;
  }

  startBattle(socketId: string): { battle: Battle } | { error: string } {
    const battle = this.findBattleBySocket(socketId);
    if (!battle) return { error: "No estás en ninguna batalla" };
    if (battle.participants.length < 2) return { error: "Se necesitan al menos 2 participantes" };

    battle.status = "in_progress";
    battle.currentRound = 1;
    battle.roundPhase = "countdown";

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
    if (!battle || battle.status !== "in_progress") return { error: "Batalla no encontrada" };

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
        battle.roundPhase = "mc1_turn";
        battle.currentTurn = mc1.userId;
        battle.timeRemaining = battle.mode.timePerTurn;
        if (battle.mode.mode === "libre") {
          battle.currentWord = undefined;
          return { battle, phase: "mc1_turn", participantId: mc1.userId, timeRemaining: battle.mode.timePerTurn, phaseToken: newToken };
        }
        const word = generateWord(battle.mode.category, battle.mode.difficulty);
        battle.currentWord = word;
        return { battle, word, phase: "mc1_turn", participantId: mc1.userId, timeRemaining: battle.mode.timePerTurn, phaseToken: newToken };
      }
      case "mc1_turn": {
        // MC1 terminó, pausa antes de MC2
        battle.roundPhase = "pause";
        battle.currentTurn = "";
        return { battle, phase: "pause", phaseToken: newToken };
      }
      case "pause": {
        // Empezar MC2 con la misma palabra
        battle.roundPhase = "mc2_turn";
        battle.currentTurn = mc2.userId;
        battle.timeRemaining = battle.mode.timePerTurn;
        return { battle, phase: "mc2_turn", participantId: mc2.userId, timeRemaining: battle.mode.timePerTurn, phaseToken: newToken };
      }
      case "mc2_turn": {
        // Ambos terminaron, fase de votación
        battle.roundPhase = "voting";
        battle.currentTurn = "";
        return { battle, phase: "voting", phaseToken: newToken };
      }
      case "voting": {
        // Ya se votó, verificar si todos los jueces votaron con rúbrica
        const voteKey = `${battle.id}:${battle.currentRound}`;
        const roundVotes = this.rubricVotes.get(voteKey) || [];
        const allJudged = battle.judges.length === 0 || roundVotes.length >= battle.judges.length;

        if (allJudged && roundVotes.length > 0) {
          // Determinar ganador por puntaje total de rúbrica
          const scores: Record<string, number> = {};
          for (const v of roundVotes) {
            const mc1Total = v.mc1Scores.flow + v.mc1Scores.lirica + v.mc1Scores.ingenio + v.mc1Scores.presencia + v.mc1Scores.tecnica;
            const mc2Total = v.mc2Scores.flow + v.mc2Scores.lirica + v.mc2Scores.ingenio + v.mc2Scores.presencia + v.mc2Scores.tecnica;
            scores[v.mc1Id] = (scores[v.mc1Id] || 0) + mc1Total;
            scores[v.mc2Id] = (scores[v.mc2Id] || 0) + mc2Total;
          }
          let winnerId = "";
          let maxScore = 0;
          for (const [pid, total] of Object.entries(scores)) {
            if (total > maxScore) { maxScore = total; winnerId = pid; }
          }
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
          battle.status = "finished";
          return { battle, phase: "round_result", phaseToken: newToken };
        }
        battle.currentRound++;
        battle.roundPhase = "countdown";
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

    const voteKey = `${battleId}:${round}`;
    const existing = this.rubricVotes.get(voteKey) || [];
    const idx = existing.findIndex(v => v.judgeId === judgeId);
    const judgeUser = this.findUserById(judgeId);
    const vote: JudgeRubricVote = {
      judgeId, judgeName: judgeUser?.alias || judgeId.slice(0, 8), round,
      mc1Id, mc2Id, mc1Scores, mc2Scores,
    };
    if (idx >= 0) existing[idx] = vote;
    else existing.push(vote);
    this.rubricVotes.set(voteKey, existing);

    const allVoted = battle.judges.every(j => existing.some(v => v.judgeId === j.id));
    let winnerIdResult: string | undefined;
    let scoresResult: Record<string, number> | undefined;

    if (allVoted) {
      const scores: Record<string, number> = {};
      for (const v of existing) {
        const mc1Total = v.mc1Scores.flow + v.mc1Scores.lirica + v.mc1Scores.ingenio + v.mc1Scores.presencia + v.mc1Scores.tecnica;
        const mc2Total = v.mc2Scores.flow + v.mc2Scores.lirica + v.mc2Scores.ingenio + v.mc2Scores.presencia + v.mc2Scores.tecnica;
        scores[v.mc1Id] = (scores[v.mc1Id] || 0) + mc1Total;
        scores[v.mc2Id] = (scores[v.mc2Id] || 0) + mc2Total;
      }
      let max = 0;
      for (const [pid, total] of Object.entries(scores)) {
        if (total > max) { max = total; winnerIdResult = pid; }
      }
      scoresResult = scores;
    }

    return { rubricVotes: existing, allVoted, winnerId: winnerIdResult, scores: scoresResult };
  }

  setMode(socketId: string, mode: BattleModeConfig): Battle | null {
    const battle = this.findBattleBySocket(socketId);
    if (!battle || battle.status !== "lobby") return null;
    battle.mode = { ...getDefaultModeConfig(mode.mode), ...mode };
    return battle;
  }

  listBattles(): Battle[] { return Array.from(this.battles.values()); }

  findBattleBySocket(socketId: string): Battle | null {
    const user = this.sockets.get(socketId);
    if (!user) return null;
    for (const battle of this.battles.values()) {
      if (battle.participants.some(p => p.userId === user.userId) || battle.judges.some(j => j.id === user.userId))
        return battle;
    }
    return null;
  }

  getSocketUser(socketId: string): SocketUser | undefined {
    return this.sockets.get(socketId);
  }

  private findUserById(userId: string): SocketUser | undefined {
    for (const u of this.sockets.values()) { if (u.userId === userId) return u; }
    return undefined;
  }
}
