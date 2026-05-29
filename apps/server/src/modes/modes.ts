import type { BattleMode, BattleModeConfig, WordCategory } from "@freestyle/shared";

/**
 * Configuración del único modo de batalla: Clásico.
 *
 * 🎤 ¿Por qué Clásico es mejor que YouTube?
 *    - Jueceo en tiempo real con rúbrica (Flow, Lírica, Ingenio, Presencia, Técnica)
 *    - Palabras aleatorias generadas por el sistema (imposible hacer trampa)
 *    - Cronómetro y fases automatizadas que meten presión real
 *    - Los jueces votan ronda por ronda, no es un video pasivo
 */
export const MODE_DEFAULTS: Record<BattleMode, BattleModeConfig> = {
  clasico: {
    mode: "clasico",
    rounds: 3,
    timePerTurn: 45,
    difficulty: "medio",
  },
};

/**
 * Devuelve la configuración por defecto para el modo clásico.
 */
export function getDefaultModeConfig(mode: BattleMode): BattleModeConfig {
  return { ...MODE_DEFAULTS[mode] };
}

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
