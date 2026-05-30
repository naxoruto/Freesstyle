"use client";

import type { BattleMode, BattleModeConfig, WordCategory, WordDifficulty } from "@freestyle/shared";

const MODES: { value: BattleMode; label: string; icon: string; desc: string }[] = [
  { value: "clasico", label: "Clásico", icon: "🎤", desc: "Con concepto aleatorio" },
  { value: "libre", label: "Libre", icon: "🔓", desc: "Sin concepto, tema libre" },
];

const TIME_OPTIONS = [
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "1 min" },
  { value: 90, label: "90s" },
  { value: 120, label: "2 min" },
];

const CATEGORIES: { value: WordCategory | "aleatorio"; label: string; icon: string }[] = [
  { value: "aleatorio", label: "Aleatorio", icon: "🎲" },
  { value: "animales", label: "Animales", icon: "🐾" },
  { value: "objetos", label: "Objetos", icon: "📦" },
  { value: "famosos", label: "Famosos", icon: "⭐" },
  { value: "abstractos", label: "Abstractos", icon: "💭" },
  { value: "acciones", label: "Acciones", icon: "🏃" },
  { value: "lugares", label: "Lugares", icon: "🌍" },
  { value: "comida", label: "Comida", icon: "🍕" },
  { value: "tecnologia", label: "Tecnología", icon: "🤖" },
];

const ROUNDS_OPTIONS = [1, 2, 3, 5];

interface Props {
  value: Partial<BattleModeConfig>;
  onChange: (config: Partial<BattleModeConfig>) => void;
  disabled?: boolean;
}

export function BattleModeSelector({ value, onChange, disabled }: Props) {
  const mode = value.mode ?? "clasico";
  const timePerTurn = value.timePerTurn ?? 45;
  const category = value.category ?? undefined;
  const rounds = value.rounds ?? 3;

  const set = (patch: Partial<BattleModeConfig>) => onChange({ ...value, ...patch });

  return (
    <div className={`space-y-5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Modo */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Modo</p>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => set({ mode: m.value })}
              className={`p-3 rounded-xl border-2 text-left transition ${
                mode === m.value
                  ? "border-red-500 bg-red-500/10"
                  : "border-gray-800 hover:border-gray-600"
              }`}
            >
              <span className="text-xl block mb-1">{m.icon}</span>
              <span className="font-bold text-white text-sm block">{m.label}</span>
              <span className="text-xs text-gray-500">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Rondas */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Rondas</p>
        <div className="flex gap-2">
          {ROUNDS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => set({ rounds: r })}
              className={`px-4 py-2 rounded-lg border-2 font-bold text-sm transition ${
                rounds === r
                  ? "border-red-500 bg-red-500/10 text-white"
                  : "border-gray-800 hover:border-gray-600 text-gray-400"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Tiempo por turno */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Tiempo por MC</p>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => set({ timePerTurn: t.value })}
              className={`px-4 py-2 rounded-lg border-2 font-bold text-sm transition ${
                timePerTurn === t.value
                  ? "border-red-500 bg-red-500/10 text-white"
                  : "border-gray-800 hover:border-gray-600 text-gray-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categoría (solo en modo clásico) */}
      {mode === "clasico" && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Categoría</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => set({ category: c.value === "aleatorio" ? undefined : c.value as WordCategory })}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                  (c.value === "aleatorio" && !category) || c.value === category
                    ? "border-red-500 bg-red-500/10 text-white"
                    : "border-gray-800 hover:border-gray-600 text-gray-400"
                }`}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
