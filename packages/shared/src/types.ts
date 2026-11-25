// ============================================================
// Tipos compartidos - Formato real FMS/Batalla de Gallos
// MC1 → MC2 → Jueces votan → Siguiente ronda
// ============================================================

export type UserRole = "participant" | "judge" | "admin" | "host" | "spectator";

export interface User {
  id: string; name: string; alias: string; role: UserRole; avatarUrl?: string;
}

export interface RoomMember {
  userId: string;
  alias: string;
  roles: UserRole[];
  connected: boolean;
}

export type WordCategory = "animales" | "objetos" | "famosos" | "abstractos" | "acciones" | "lugares" | "comida" | "tecnologia";
export type WordDifficulty = "facil" | "medio" | "dificil";

export interface Word {
  id: string; text: string; category: WordCategory; difficulty: WordDifficulty;
}

export type BattleMode = "clasico" | "libre" | "variado";

/** Formato de batalla: determina cuántas entradas tiene cada MC y la estructura de turnos. */
export type BattleFormat = "1x1" | "4x4" | "8x8";

export type VotingSystem = "rubrica" | "patron" | "free_vote" | "room_vote";

export interface BattleModeConfig {
  mode: BattleMode;
  format: BattleFormat;
  rounds: number;
  timePerTurn: number;
  category?: WordCategory;
  difficulty: WordDifficulty;
  firstTurnParticipantId?: string; // undefined = random
  showScoresToSpectators: boolean;
  timerMode: "countdown" | "manual";
  entriesPerParticipant: number;
  votingSystem: VotingSystem;
  turnStructure: "one_way" | "round_trip";
  liveControlEnabled: boolean;
  /** Modalidad exhibición: sin jueces ni puntaje; termina sin ganador. */
  exhibition: boolean;
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
  replica?: number;
  winnerId?: string;
  scores: Record<string, number>;
  judgeVotes: { judgeId: string; judgeName: string; votedForId?: string }[];
}

export interface Battle {
  recovery?: { paused: true; issue?: string };
  id: string; mode: BattleModeConfig; status: BattleStatus; participants: Participant[];
  judges: { id: string; alias: string }[]; spectators: { id: string; alias: string }[]; members: RoomMember[]; currentRound: number; roundPhase: RoundPhase; currentTurn: string;
  currentWord?: Word; timeRemaining: number; phaseDeadline?: string; phaseToken?: string; entriesRemaining: Record<string, number>; pendingEntry?: { mcId: string; entryIndex: number }; totalScores: Record<string, number>; roundResults: BattleRoundResult[]; turnSequenceIndex: number; replicaCount: number; replicaConfig?: ReplicaConfig; createdAt: string; adminId?: string; hostId?: string;
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

export interface FreeVote {
  judgeId: string;
  judgeName: string;
  round: number;
  mc1Id: string;
  mc2Id: string;
  votedForId: string; // who the judge picked as winner
}

export interface TournamentParticipant {
  userId: string; alias: string; eliminated: boolean;
}

export interface RoomVote {
  voterId: string;
  voterName: string;
  round: number;
  mc1Id: string;
  mc2Id: string;
  votedForId: string;
}

export interface TournamentBattle {
  battleId?: string; mc1Id?: string; mc2Id?: string; winnerId?: string;
}

export interface TournamentPhase {
  name: string; battles: TournamentBattle[]; modeConfig: BattleModeConfig; replicaConfig?: ReplicaConfig;
}

export type TournamentType = "single_elimination" | "with_third_place" | "king_of_the_hill" | "double_elimination";

export type TournamentCapacity = 4 | 8 | 16;

export interface TournamentAuditEntry {
  at: string;
  actorId: string;
  action: string;
  detail: string;
}

export interface Tournament {
  id: string; name: string; status: "setup" | "in_progress" | "finished";
  participants: TournamentParticipant[]; phases: TournamentPhase[]; currentPhaseIndex: number;
  bracketMode: "manual" | "random"; createdAt: string; winnerId?: string;
  type: TournamentType;
  logo?: string;
  organizer?: string;
  capacity: TournamentCapacity;
  suplentes: TournamentParticipant[];
  auditLog: TournamentAuditEntry[];
  thirdPlaceMatch?: TournamentBattle;
  losersPhases?: TournamentPhase[];
  grandFinal?: TournamentBattle;
  grandFinalReset?: TournamentBattle;
}

export type ServerEvent =
  | { type: "battle:state"; battle: Battle }
  | { type: "battle:round_start"; round: number; word: Word; totalRounds: number }
  | { type: "battle:phase"; phase: RoundPhase; participantId?: string; timeRemaining?: number; phaseToken?: string }
  | { type: "battle:timer"; timeRemaining: number }
  | { type: "battle:round_result"; round: number; winnerId?: string; rubricVotes: JudgeRubricVote[]; scores: Record<string, number> }
  | { type: "battle:winner"; winnerId: string; finalScores: Record<string, number> }
  | { type: "battle:error"; message: string }
  | { type: "battle:session"; sessionId: string }
  | { type: "battle:invitation"; token: string }
  | { type: "room:joined"; userId: string; roles: UserRole[] }
  | { type: "room:left"; userId: string };

export type ClientEvent =
  | { type: "battle:join"; battleId: string; user: { id: string; name: string; alias: string; role?: UserRole }; adminToken?: string; inviteToken?: string }
  | { type: "battle:leave" }
  | { type: "battle:start" }
  | { type: "battle:resume"; action: "continue" | "restart_clock" }
  | { type: "battle:next_phase"; phaseToken?: string }
  | { type: "judge:vote_rubric"; battleId: string; round: number; mc1Id: string; mc2Id: string; mc1Scores: ScoreRubric; mc2Scores: ScoreRubric }
  | { type: "battle:set_mode"; mode: BattleModeConfig }
  | { type: "battle:set_host"; targetUserId: string }
  | { type: "battle:complete_entry" }
  | { type: "judge:vote_entry"; battleId: string; points: number }
  | { type: "judge:vote_patron_extra"; battleId: string; mc1Extra: number; mc2Extra: number }
  | { type: "battle:set_replica"; config: ReplicaConfig }
  | { type: "battle:reconnect"; battleId: string; sessionId: string }
  | { type: "battle:change_role"; targetUserId: string; newRole: UserRole }
  | { type: "battle:revoke_role"; targetUserId: string; role: UserRole }
  | { type: "battle:grant_admin"; targetUserId: string }
  | { type: "battle:transfer_admin"; targetUserId: string }
  | { type: "battle:revoke_admin"; targetUserId: string }
  | { type: "battle:create_invitation"; regenerate?: boolean }
  | { type: "room:vote"; battleId: string; votedForId: string }
  | { type: "judge:vote_free"; battleId: string; votedForId: string };

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
    participations: DailyAttributeResult;
    titles: DailyAttributeResult;
  };
}

export interface FreestylerDailyAnswer {
  id: string;
  alias: string;
  country: string;
  birthYear: number;
  debutYear: number | null;
  participations: number;
  participationCompetitions: string[];
  titles: number;
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
