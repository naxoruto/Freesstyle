// ============================================================
// Tipos compartidos - Formato real FMS/Batalla de Gallos
// MC1 → MC2 → Jueces votan → Siguiente ronda
// ============================================================

export type UserRole = "participant" | "judge" | "admin";

export interface User {
  id: string; name: string; alias: string; role: UserRole; avatarUrl?: string;
}

export type WordCategory = "animales" | "objetos" | "famosos" | "abstractos" | "acciones" | "lugares" | "comida" | "tecnologia";
export type WordDifficulty = "facil" | "medio" | "dificil";

export interface Word {
  id: string; text: string; category: WordCategory; difficulty: WordDifficulty;
}

export type BattleMode = "clasico" | "contrarreloj" | "tematico" | "muerte-subita" | "por-equipos";

export interface BattleModeConfig {
  mode: BattleMode; rounds: number; timePerTurn: number; category?: WordCategory; difficulty: WordDifficulty;
}

export type RoundPhase = "countdown" | "mc1_turn" | "pause" | "mc2_turn" | "voting" | "round_result";
export type BattleStatus = "lobby" | "in_progress" | "finished";

export interface Participant {
  userId: string; name: string; alias: string; isActive: boolean; currentScore: number; roundsWon: number;
}

export interface Battle {
  id: string; mode: BattleModeConfig; status: BattleStatus; participants: Participant[];
  judges: string[]; currentRound: number; roundPhase: RoundPhase; currentTurn: string;
  currentWord?: Word; timeRemaining: number; createdAt: string;
}

export interface ScoreRubric {
  flow: number; lirica: number; ingenio: number; presencia: number; tecnica: number;
}

export interface RoundVote {
  judgeId: string; judgeName: string; winnerId: string; round: number;
}

export type ServerEvent =
  | { type: "battle:state"; battle: Battle }
  | { type: "battle:round_start"; round: number; word: Word; totalRounds: number }
  | { type: "battle:phase"; phase: RoundPhase; participantId?: string; timeRemaining?: number }
  | { type: "battle:timer"; timeRemaining: number }
  | { type: "battle:round_result"; round: number; winnerId: string; votes: RoundVote[] }
  | { type: "battle:winner"; winnerId: string; finalScores: Record<string, number> }
  | { type: "battle:error"; message: string }
  | { type: "room:joined"; userId: string; role: UserRole }
  | { type: "room:left"; userId: string };

export type ClientEvent =
  | { type: "battle:join"; battleId: string; user: Pick<User, "id" | "name" | "alias" | "role"> }
  | { type: "battle:leave" }
  | { type: "battle:start" }
  | { type: "battle:next_phase" }
  | { type: "judge:vote_round"; battleId: string; round: number; winnerId: string }
  | { type: "battle:set_mode"; mode: BattleModeConfig };
