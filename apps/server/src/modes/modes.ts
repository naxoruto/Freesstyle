import type { BattleMode, BattleModeConfig, WordCategory, WordDifficulty } from "@freestyle/shared";

/**
 * Configuraciones predefinidas para cada modo de batalla.
 */
export const MODE_DEFAULTS: Record<BattleMode, BattleModeConfig> = {
  clasico: {
    mode: "clasico",
    rounds: 3,
    timePerTurn: 45,
    difficulty: "medio",
  },
  contrarreloj: {
    mode: "contrarreloj",
    rounds: 5,
    timePerTurn: 0,  // Sin límite, siguiente palabra al acabar
    difficulty: "medio",
  },
  tematico: {
    mode: "tematico",
    rounds: 3,
    timePerTurn: 45,
    category: "animales",
    difficulty: "medio",
  },
  "muerte-subita": {
    mode: "muerte-subita",
    rounds: 0,       // Infinito hasta que alguien falle
    timePerTurn: 0,   // Sin tiempo, el juez decide
    difficulty: "dificil",
  },
  "por-equipos": {
    mode: "por-equipos",
    rounds: 4,
    timePerTurn: 60,
    difficulty: "medio",
  },
};

/**
 * Devuelve la configuración por defecto para un modo.
 */
export function getDefaultModeConfig(mode: BattleMode): BattleModeConfig {
  return { ...MODE_DEFAULTS[mode] };
}

/**
 * Lista de modos con descripciones para mostrar en UI.
 */
export const MODE_DESCRIPTIONS: Record<
  BattleMode,
  { name: string; description: string; icon: string }
> = {
  clasico: {
    name: "Clásico",
    description: "1 palabra cada 45s, alternando turnos. 3 rounds.",
    icon: "🎤",
  },
  contrarreloj: {
    name: "Contrarreloj",
    description: "Palabra nueva cuando termina el anterior. 5 rounds sin pausa.",
    icon: "⏱️",
  },
  tematico: {
    name: "Temático",
    description: "Todas las palabras de una misma categoría. 3 rounds.",
    icon: "🎯",
  },
  "muerte-subita": {
    name: "Muerte Súbita",
    description: "Sin límite de rounds. Pierde el que se traba. Sin cronómetro.",
    icon: "💀",
  },
  "por-equipos": {
    name: "Por Equipos",
    description: "2vs2 o más. 4 rounds con 60s por turno.",
    icon: "👥",
  },
};

/**
 * Categorías disponibles con nombre amigable.
 */
export const CATEGORY_LABELS: Record<WordCategory, string> = {
  animales: "🐾 Animales",
  objetos: "📦 Objetos",
  famosos: "⭐ Famosos",
  abstractos: "💭 Abstractos",
  acciones: "🏃 Acciones",
  lugares: "🌍 Lugares",
  comida: "🍕 Comida",
  tecnologia: "🤖 Tecnología",
};
