// ============================================================
// Tipos compartidos - Formato real FMS/Batalla de Gallos
// MC1 → MC2 → Jueces votan → Siguiente ronda
// ============================================================

export type UserRole = "participant" | "judge" | "admin" | "host" | "spectator";

export interface User {
  id: string; name: string; alias: string; role: UserRole; avatarUrl?: string;
}

export type WordCategory = "animales" | "objetos" | "famosos" | "abstractos" | "acciones" | "lugares" | "comida" | "tecnologia";
export type WordDifficulty = "facil" | "medio" | "dificil";

export interface Word {
  id: string; text: string; category: WordCategory; difficulty: WordDifficulty;
}

export type BattleMode = "clasico" | "libre";

export interface BattleModeConfig {
  mode: BattleMode; rounds: number; timePerTurn: number; category?: WordCategory; difficulty: WordDifficulty;
  firstTurnParticipantId?: string; // undefined = random
  showVotesToSpectators?: boolean; // default true — controla si spectators ven rúbricas detalladas
}

export type RoundPhase = "countdown" | "mc1_turn" | "pause" | "mc2_turn" | "voting" | "round_result";
export type BattleStatus = "lobby" | "in_progress" | "finished";

export interface Participant {
  userId: string; name: string; alias: string; isActive: boolean; currentScore: number; roundsWon: number;
}

export interface Battle {
  id: string; mode: BattleModeConfig; status: BattleStatus; participants: Participant[];
  judges: { id: string; alias: string }[]; hosts: { id: string; alias: string }[]; hostId: string;
  spectators: { id: string; alias: string }[]; currentRound: number; roundPhase: RoundPhase; currentTurn: string;
  currentWord?: Word; timeRemaining: number; createdAt: string;
}

export interface ScoreRubric {
  flow: number; lirica: number; ingenio: number; presencia: number; tecnica: number;
}

export interface RoundVote {
  judgeId: string; judgeName: string; winnerId: string; round: number;
}

/** Rúbrica de un juez para AMBOS MCs en una ronda */
export interface JudgeRubricVote {
  judgeId: string; judgeName: string; round: number;
  mc1Scores: ScoreRubric;
  mc2Scores: ScoreRubric;
  mc1Id: string;
  mc2Id: string;
}

export type ServerEvent =
  | { type: "battle:state"; battle: Battle }
  | { type: "battle:round_start"; round: number; word: Word; totalRounds: number }
  | { type: "battle:phase"; phase: RoundPhase; participantId?: string; timeRemaining?: number }
  | { type: "battle:timer"; timeRemaining: number }
  | { type: "battle:round_result"; round: number; winnerId: string; rubricVotes: JudgeRubricVote[]; scores: Record<string, number> }
  | { type: "battle:winner"; winnerId: string; finalScores: Record<string, number> }
  | { type: "battle:error"; message: string }
  | { type: "room:joined"; userId: string; role: UserRole }
  | { type: "room:left"; userId: string }
  | { type: "room:role_changed"; userId: string; oldRole?: UserRole; newRole: UserRole };

export type ClientEvent =
  | { type: "battle:join"; battleId: string; user: Pick<User, "id" | "name" | "alias" | "role"> }
  | { type: "battle:leave" }
  | { type: "battle:start" }
  | { type: "battle:next_phase" }
  | { type: "judge:vote_rubric"; battleId: string; round: number; mc1Id: string; mc2Id: string; mc1Scores: ScoreRubric; mc2Scores: ScoreRubric }
  | { type: "battle:set_mode"; mode: BattleModeConfig }
  | { type: "room:transfer_host"; battleId: string; targetUserId: string };
