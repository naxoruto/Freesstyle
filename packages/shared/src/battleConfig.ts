import type { BattleFormat, BattleMode, BattleModeConfig, VotingSystem } from "./types";

// ============================================================
// Configuración canónica de batalla
//
// Este archivo es la fuente de verdad para:
// - Formatos de batalla (1x1, 4x4, 8x8)
// - Métodos de votación y sus reglas
// - Reglas de réplica
// - Validación y normalización de configuración
// ============================================================

// --- Formatos ---

export interface BattleFormatDefaults {
  label: string;
  entriesPerParticipant: number;
  timerMode: "countdown" | "manual";
  turnStructure: "one_way" | "round_trip";
  defaultTimePerTurn: number;
  defaultRounds: number;
}

export const FORMAT_DEFAULTS: Record<BattleFormat, BattleFormatDefaults> = {
  "1x1": {
    label: "1x1 — Una entrada por MC",
    entriesPerParticipant: 1,
    timerMode: "countdown",
    turnStructure: "one_way",
    defaultTimePerTurn: 60,
    defaultRounds: 3,
  },
  "4x4": {
    label: "4x4 — Cuatro entradas por MC",
    entriesPerParticipant: 4,
    timerMode: "manual",
    turnStructure: "one_way",
    defaultTimePerTurn: 0,
    defaultRounds: 2,
  },
  "8x8": {
    label: "8x8 — Ocho entradas por MC",
    entriesPerParticipant: 8,
    timerMode: "manual",
    turnStructure: "one_way",
    defaultTimePerTurn: 0,
    defaultRounds: 2,
  },
};

// --- Reglas de interacción ---

/**
 * En modo manual (entradas), la estructura de turno siempre es one_way.
 * En modo countdown, el admin puede elegir one_way o round_trip.
 */
export const MANUAL_MODE_LOCKS = {
  timerMode: "manual" as const,
  turnStructure: "one_way" as const,
};

/**
 * Rango permitido para entradas por participante según formato.
 */
export const ENTRIES_PER_FORMAT: Record<BattleFormat, { min: number; max: number }> = {
  "1x1": { min: 1, max: 1 },
  "4x4": { min: 2, max: 6 },
  "8x8": { min: 4, max: 12 },
};

// --- Métodos de votación ---

export interface VotingMethodRules {
  label: string;
  description: string;
  scoreRange: { min: number; max: number };
  /** Si true, se vota después de cada entrada del MC. Si false, al final de la ronda. */
  perEntry: boolean;
  /** Si true, requiere votos extra (impresión general) al final. */
  requiresExtra: boolean;
  /** Cantidad de dimensiones evaluadas. */
  dimensions: number;
}

export const VOTING_METHODS: Record<VotingSystem, VotingMethodRules> = {
  rubrica: {
    label: "Rúbrica (5 dimensiones)",
    description:
      "Cada juez evalúa Flow, Lírica, Ingenio, Presencia y Técnica (0-10 cada una). Se vota al final de cada ronda.",
    scoreRange: { min: 0, max: 10 },
    perEntry: false,
    requiresExtra: false,
    dimensions: 5,
  },
  patron: {
    label: "Patrón (FMS / Red Bull)",
    description:
      "Cada juez vota un puntaje (0-4) por cada entrada de cada MC. Al finalizar todas las entradas, se emiten puntos extra (0-4) por impresión general.",
    scoreRange: { min: 0, max: 4 },
    perEntry: true,
    requiresExtra: true,
    dimensions: 1,
  },
  free_vote: {
    label: "Voto libre",
    description:
      "Cada juez elige directamente al ganador de la ronda. Gana el MC con más votos del jurado.",
    scoreRange: { min: 0, max: 1 },
    perEntry: false,
    requiresExtra: false,
    dimensions: 1,
  },
  room_vote: {
    label: "Voto de sala",
    description:
      "Todos los miembros conectados y con rol, excepto los MC activos, eligen directamente al ganador.",
    scoreRange: { min: 0, max: 1 },
    perEntry: false,
    requiresExtra: false,
    dimensions: 1,
  },
};

/** Método de votación permitido según el timerMode. */
export const VOTING_COMPATIBILITY: Record<string, VotingSystem[]> = {
  countdown: ["rubrica", "free_vote", "room_vote"],
  manual: ["rubrica", "patron", "free_vote", "room_vote"],
};

// --- Réplicas ---

export interface ReplicaRules {
  description: string;
  minMaxReplicas: number;
  maxMaxReplicas: number;
  minTieRange: number;
  maxTieRange: number;
  /** Las réplicas siempre usan el formato y modo configurados en la réplica, no el de la batalla original. */
  independentConfig: true;
  /** El contador de réplicas se reinicia en cada batalla nueva. */
  perBattleCounter: true;
}

export const REPLICA_RULES: ReplicaRules = {
  description:
    "Una réplica es una batalla completa independiente que se ejecuta en la misma sala. Se dispara al finalizar la batalla si la diferencia de puntaje total entre los MC es menor o igual a tieRange. Cada réplica usa su propia configuración de formato y modo, permitiendo cambiar reglas para el desempate.",
  minMaxReplicas: 1,
  maxMaxReplicas: 5,
  minTieRange: 0,
  maxTieRange: 100,
  independentConfig: true,
  perBattleCounter: true,
};

// --- Validación ---

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

const ROUNDS_MIN = 1;
const ROUNDS_MAX = 5;
const COUNTDOWN_TIMES = [30, 45, 60, 90, 120];

export function validateConfig(config: BattleModeConfig): ConfigValidationResult {
  const errors: string[] = [];

  if (!["clasico", "libre"].includes(config.mode)) {
    errors.push(`Modo inválido: ${config.mode}`);
  }

  if (!["1x1", "4x4", "8x8"].includes(config.format)) {
    errors.push(`Formato inválido: ${config.format}`);
  }

  if (!["rubrica", "patron", "free_vote", "room_vote"].includes(config.votingSystem)) {
    errors.push(`Sistema de votación inválido: ${config.votingSystem}`);
  }

  if (config.rounds < ROUNDS_MIN || config.rounds > ROUNDS_MAX) {
    errors.push(`Rondas fuera de rango (${ROUNDS_MIN}-${ROUNDS_MAX}): ${config.rounds}`);
  }

  if (!["countdown", "manual"].includes(config.timerMode)) {
    errors.push(`Timer mode inválido: ${config.timerMode}`);
  }

  if (!["one_way", "round_trip"].includes(config.turnStructure)) {
    errors.push(`Turn structure inválida: ${config.turnStructure}`);
  }

  if (config.timerMode === "countdown" && !COUNTDOWN_TIMES.includes(config.timePerTurn)) {
    errors.push(`timePerTurn debe ser uno de: ${COUNTDOWN_TIMES.join(", ")}`);
  }

  if (config.timerMode === "manual") {
    if (config.turnStructure !== "one_way") {
      errors.push("Modo manual requiere turnStructure 'one_way'");
    }
    const range = ENTRIES_PER_FORMAT[config.format];
    if (config.entriesPerParticipant < range.min || config.entriesPerParticipant > range.max) {
      errors.push(`Entradas fuera de rango para ${config.format}: ${range.min}-${range.max}`);
    }
  }

  // Compatibilidad de votación
  const compatible = VOTING_COMPATIBILITY[config.timerMode];
  if (compatible && !compatible.includes(config.votingSystem)) {
    errors.push(
      `Sistema de votación '${config.votingSystem}' no compatible con timerMode '${config.timerMode}'. Compatibles: ${compatible.join(", ")}`,
    );
  }

  // Patron requiere que haya al menos 1 entrada
  if (config.votingSystem === "patron" && config.entriesPerParticipant < 1) {
    errors.push("Patron requiere al menos 1 entrada por participante");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normaliza una configuración aplicando defaults del formato.
 * Usado para completar campos faltantes al crear o modificar una batalla.
 */
export function normalizeConfig(
  partial: Partial<BattleModeConfig> & { mode?: BattleMode },
  mode: BattleMode,
): BattleModeConfig {
  const format: BattleFormat = partial.format ?? "1x1";
  const fmt = FORMAT_DEFAULTS[format];

  return {
    mode,
    format,
    rounds: partial.rounds ?? fmt.defaultRounds,
    timePerTurn: partial.timePerTurn ?? fmt.defaultTimePerTurn,
    difficulty: partial.difficulty ?? "medio",
    showScoresToSpectators: partial.showScoresToSpectators ?? true,
    timerMode: partial.timerMode ?? fmt.timerMode,
    entriesPerParticipant: partial.entriesPerParticipant ?? fmt.entriesPerParticipant,
    votingSystem: partial.votingSystem ?? "rubrica",
    turnStructure: partial.turnStructure ?? fmt.turnStructure,
    liveControlEnabled: partial.liveControlEnabled ?? true,
    category: partial.category,
    firstTurnParticipantId: partial.firstTurnParticipantId,
  };
}

/**
 * Crea una configuración por defecto para un modo y formato dados.
 */
export function createDefaultConfig(mode: BattleMode, format: BattleFormat = "1x1"): BattleModeConfig {
  return normalizeConfig({ format }, mode);
}

/**
 * Verifica si un formato opera con timer manual (entradas por host/admin).
 */
export function isManualFormat(format: BattleFormat): boolean {
  return FORMAT_DEFAULTS[format].timerMode === "manual";
}
