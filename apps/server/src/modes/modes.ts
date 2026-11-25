import type { BattleMode, BattleModeConfig, WordCategory } from "@freestyle/shared";

export const MODE_DEFAULTS: Record<BattleMode, BattleModeConfig> = {
  clasico: {
    mode: "clasico",
    format: "1x1",
    rounds: 3,
    timePerTurn: 45,
    difficulty: "medio",
    showScoresToSpectators: true,
    timerMode: "countdown",
    entriesPerParticipant: 1,
    votingSystem: "rubrica",
    turnStructure: "one_way",
    liveControlEnabled: true,
  },
  libre: {
    mode: "libre",
    format: "1x1",
    rounds: 3,
    timePerTurn: 60,
    difficulty: "medio",
    showScoresToSpectators: true,
    timerMode: "countdown",
    entriesPerParticipant: 1,
    votingSystem: "rubrica",
    turnStructure: "one_way",
    liveControlEnabled: true,
  },
  variado: {
    mode: "variado",
    format: "1x1",
    rounds: 3,
    timePerTurn: 60,
    difficulty: "medio",
    showScoresToSpectators: true,
    timerMode: "countdown",
    entriesPerParticipant: 1,
    votingSystem: "rubrica",
    turnStructure: "one_way",
    liveControlEnabled: true,
  },
};

export function getDefaultModeConfig(mode: BattleMode): BattleModeConfig {
  return { ...MODE_DEFAULTS[mode] };
}

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
