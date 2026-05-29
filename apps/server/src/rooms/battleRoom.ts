import { v4 as uuid } from "uuid";
import type { Battle, BattleModeConfig, Participant, User, RoundVote, Word, RoundPhase } from "@freestyle/shared";
import { generateWord } from "../words/wordGenerator";
import { getDefaultModeConfig } from "../modes/modes";

interface SocketUser { socketId: string; userId: string; name: string; alias: string; role: string; }

export class BattleRoomManager {
  private battles = new Map<string, Battle>();
  private sockets = new Map<string, SocketUser>();
  private votes = new Map<string, RoundVote[]>(); // key: battleId:round
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
      if (!battle.judges.includes(user.id)) battle.judges.push(user.id);
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
      if (battle.judges.includes(user.userId)) {
        battle.judges = battle.judges.filter(j => j !== user.userId);
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
    // Generate a phase token so we can track idempotency
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
  nextPhase(battleId: string, expectedToken?: string): { battle: Battle; word?: Word; phase: RoundPhase; participantId?: string; timeRemaining?: number; phaseToken: string } | { error: string } {
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
        // Empezar turno MC1
        battle.roundPhase = "mc1_turn";
        const word = generateWord(battle.mode.category, battle.mode.difficulty);
        battle.currentWord = word;
        battle.currentTurn = mc1.userId;
        battle.timeRemaining = battle.mode.timePerTurn;
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
        // Ya se votó, verificar si todos los jueces votaron
        const voteKey = `${battle.id}:${battle.currentRound}`;
        const roundVotes = this.votes.get(voteKey) || [];
        const allJudged = battle.judges.length === 0 || roundVotes.length >= battle.judges.length;

        if (allJudged && roundVotes.length > 0) {
          // Determinar ganador de la ronda
          const voteCounts: Record<string, number> = {};
          for (const v of roundVotes) {
            voteCounts[v.winnerId] = (voteCounts[v.winnerId] || 0) + 1;
          }
          let winnerId = "";
          let maxVotes = 0;
          for (const [pid, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) { maxVotes = count; winnerId = pid; }
          }
          // Actualizar rounds ganados
          const winner = battle.participants.find(p => p.userId === winnerId);
          if (winner) winner.roundsWon++;

          battle.roundPhase = "round_result";
          return { battle, phase: "round_result", phaseToken: newToken };
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

  submitVote(battleId: string, judgeId: string, round: number, winnerId: string): { votes: RoundVote[]; allVoted: boolean; winnerId?: string } | { error: string } {
    const battle = this.battles.get(battleId.toLowerCase());
    if (!battle) return { error: "Batalla no encontrada" };
    if (!battle.judges.includes(judgeId)) return { error: "No eres juez" };

    const voteKey = `${battleId}:${round}`;
    const existing = this.votes.get(voteKey) || [];
    const idx = existing.findIndex(v => v.judgeId === judgeId);
    const judgeUser = this.findUserById(judgeId);
    const vote: RoundVote = { judgeId, judgeName: judgeUser?.alias || judgeId.slice(0, 8), winnerId, round };
    if (idx >= 0) existing[idx] = vote;
    else existing.push(vote);
    this.votes.set(voteKey, existing);

    const allVoted = battle.judges.every(jid => existing.some(v => v.judgeId === jid));
    let winnerIdResult: string | undefined;
    if (allVoted) {
      const counts: Record<string, number> = {};
      for (const v of existing) counts[v.winnerId] = (counts[v.winnerId] || 0) + 1;
      let max = 0;
      for (const [pid, c] of Object.entries(counts)) { if (c > max) { max = c; winnerIdResult = pid; } }
    }

    return { votes: existing, allVoted, winnerId: winnerIdResult };
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
      if (battle.participants.some(p => p.userId === user.userId) || battle.judges.includes(user.userId))
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
