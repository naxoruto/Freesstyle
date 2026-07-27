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
export type VotingSystem = "rubrica" | "patron";

export interface BattleModeConfig {
  mode: BattleMode; rounds: number; timePerTurn: number; category?: WordCategory; difficulty: WordDifficulty;
  firstTurnParticipantId?: string; // undefined = random
  showScoresToSpectators: boolean;
  timerMode: "countdown" | "manual";
  entriesPerParticipant: number;
  votingSystem: VotingSystem;
  turnStructure: "one_way" | "round_trip";
}

export type RoundPhase = "countdown" | "mc1_turn" | "pause" | "mc2_turn" | "entry_voting" | "voting" | "round_result";
export type BattleStatus = "lobby" | "in_progress" | "replica" | "finished";

export interface ReplicaConfig {
  enabled: boolean; maxReplicas: number; tieRange: number; mode: BattleModeConfig;
}

export interface Participant {
  userId: string; name: string; alias: string; isActive: boolean; currentScore: number; roundsWon: number;
}

export interface BattleRoundResult {
  round: number;
  winnerId?: string;
  scores: Record<string, number>;
  judgeVotes: { judgeId: string; judgeName: string; votedForId?: string }[];
}

export interface Battle {
  id: string; mode: BattleModeConfig; status: BattleStatus; participants: Participant[];
  judges: { id: string; alias: string }[]; spectators: { id: string; alias: string }[]; currentRound: number; roundPhase: RoundPhase; currentTurn: string;
  currentWord?: Word; timeRemaining: number; entriesRemaining: Record<string, number>; pendingEntry?: { mcId: string; entryIndex: number }; totalScores: Record<string, number>; roundResults: BattleRoundResult[]; turnSequenceIndex: number; replicaCount: number; replicaConfig?: ReplicaConfig; createdAt: string; adminId?: string; hostId?: string;
}

export interface ScoreRubric {
  flow: number; lirica: number; ingenio: number; presencia: number; tecnica: number;
}

/** Rúbrica de un juez para AMBOS MCs en una ronda */
export interface JudgeRubricVote {
  judgeId: string; judgeName: string; round: number;
  mc1Scores: ScoreRubric;
  mc2Scores: ScoreRubric;
  mc1Id: string;
  mc2Id: string;
}

export interface PatronEntryVote {
  judgeId: string; judgeName: string; round: number; entryIndex: number; mcId: string; points: number;
}

export interface PatronExtraVote {
  judgeId: string; judgeName: string; round: number; mc1Id: string; mc2Id: string; mc1Extra: number; mc2Extra: number;
}

export interface TournamentParticipant {
  userId: string; alias: string; eliminated: boolean;
}

export interface TournamentBattle {
  battleId?: string; mc1Id?: string; mc2Id?: string; winnerId?: string;
}

export interface TournamentPhase {
  name: string; battles: TournamentBattle[]; modeConfig: BattleModeConfig; replicaConfig?: ReplicaConfig;
}

export interface Tournament {
  id: string; name: string; status: "setup" | "in_progress" | "finished";
  participants: TournamentParticipant[]; phases: TournamentPhase[]; currentPhaseIndex: number;
  bracketMode: "manual" | "random"; createdAt: string; winnerId?: string;
}

export type ServerEvent =
  | { type: "battle:state"; battle: Battle }
  | { type: "battle:round_start"; round: number; word: Word; totalRounds: number }
  | { type: "battle:phase"; phase: RoundPhase; participantId?: string; timeRemaining?: number; phaseToken?: string }
  | { type: "battle:timer"; timeRemaining: number }
  | { type: "battle:round_result"; round: number; winnerId?: string; rubricVotes: JudgeRubricVote[]; scores: Record<string, number> }
  | { type: "battle:winner"; winnerId: string; finalScores: Record<string, number> }
  | { type: "battle:error"; message: string }
  | { type: "room:joined"; userId: string; role: UserRole }
  | { type: "room:left"; userId: string };

export type ClientEvent =
  | { type: "battle:join"; battleId: string; user: Pick<User, "id" | "name" | "alias" | "role">; adminToken?: string }
  | { type: "battle:leave" }
  | { type: "battle:start" }
  | { type: "battle:next_phase"; phaseToken?: string }
  | { type: "judge:vote_rubric"; battleId: string; round: number; mc1Id: string; mc2Id: string; mc1Scores: ScoreRubric; mc2Scores: ScoreRubric }
  | { type: "battle:set_mode"; mode: BattleModeConfig }
  | { type: "battle:set_host"; targetUserId: string }
  | { type: "battle:complete_entry" }
  | { type: "judge:vote_entry"; battleId: string; points: number }
  | { type: "judge:vote_patron_extra"; battleId: string; mc1Extra: number; mc2Extra: number }
  | { type: "battle:set_replica"; config: ReplicaConfig };

export type DailyMatchStatus = "exact" | "close" | "miss";
export type DailyDirection = "higher" | "lower";

export interface DailyAttributeResult {
  value: string | number | boolean;
  label: string;
  status: DailyMatchStatus;
  direction?: DailyDirection;
}

export interface FreestylerDailyGuess {
  freestylerId: string;
  alias: string;
  isCorrect: boolean;
  attributes: {
    country: DailyAttributeResult;
    birthYear: DailyAttributeResult;
    redBullInternational: DailyAttributeResult;
    fmsParticipant: DailyAttributeResult;
    podiums: DailyAttributeResult;
    titles: DailyAttributeResult;
  };
}

export interface FreestylerDailyAnswer {
  id: string;
  alias: string;
  country: string;
}

export interface FreestylerDailyState {
  dateKey: string;
  maxAttempts: number;
  attemptsRemaining: number;
  completed: boolean;
  won: boolean | null;
  guesses: FreestylerDailyGuess[];
  answer?: FreestylerDailyAnswer;
}
