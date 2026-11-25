"use client";

import type { BattleMode, BattleModeConfig, BattleFormat, WordCategory } from "@freestyle/shared";
import { FORMAT_DEFAULTS } from "@freestyle/shared";

const MODES: { value: BattleMode; label: string; desc: string }[] = [
  { value: "clasico", label: "Clásico", desc: "Con concepto aleatorio" },
  { value: "libre", label: "Libre", desc: "Sin concepto, tema libre" },
];

const FORMATS: { value: BattleFormat; label: string; desc: string }[] = [
  { value: "1x1", label: "1x1", desc: "Una entrada por MC, por tiempo" },
  { value: "4x4", label: "4x4", desc: "4 entradas por MC, por control" },
  { value: "8x8", label: "8x8", desc: "8 entradas por MC, por control" },
];

const TIME_OPTIONS = [
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "1 min" },
  { value: 90, label: "90s" },
  { value: 120, label: "2 min" },
];

const CATEGORIES: { value: WordCategory | "aleatorio"; label: string }[] = [
  { value: "aleatorio", label: "Aleatorio" },
  { value: "animales", label: "Animales" },
  { value: "objetos", label: "Objetos" },
  { value: "famosos", label: "Famosos" },
  { value: "abstractos", label: "Abstractos" },
  { value: "acciones", label: "Acciones" },
  { value: "lugares", label: "Lugares" },
  { value: "comida", label: "Comida" },
  { value: "tecnologia", label: "Tecnología" },
];

const ROUNDS_OPTIONS = [1, 2, 3, 4, 5];
const ENTRY_OPTIONS = [2, 3, 4, 5, 6];

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
  const timerMode = value.timerMode ?? "countdown";
  const entriesPerParticipant = value.entriesPerParticipant ?? 4;
  const turnStructure = value.turnStructure ?? "one_way";
  const format = value.format ?? "1x1";

  const set = (patch: Partial<BattleModeConfig>) => onChange({ ...value, ...patch });

  const handleFormatChange = (f: BattleFormat) => {
    const fmt = FORMAT_DEFAULTS[f];
    set({
      format: f,
      entriesPerParticipant: fmt.entriesPerParticipant,
      timerMode: fmt.timerMode,
      turnStructure: fmt.turnStructure,
      timePerTurn: fmt.defaultTimePerTurn,
      rounds: fmt.defaultRounds,
    });
  };

  return (
    <div className={`space-y-5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Formato */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Formato</p>
        <div className="grid grid-cols-3 gap-2">
          {FORMATS.map((f) => (
            <button
              type="button"
              key={f.value}
              onClick={() => handleFormatChange(f.value)}
              aria-pressed={format === f.value}
              className={`p-3 rounded-xl border-2 text-left transition ${
                format === f.value
                  ? "border-red-500 bg-red-500/10"
                  : "border-gray-800 hover:border-gray-600"
              }`}
            >
              <span className="font-bold text-white text-sm block">{f.label}</span>
              <span className="text-xs text-gray-500">{f.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modo */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Modo</p>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.value}
              onClick={() => set({ mode: m.value })}
              aria-pressed={mode === m.value}
              className={`p-3 rounded-xl border-2 text-left transition ${
                mode === m.value
                  ? "border-red-500 bg-red-500/10"
                  : "border-gray-800 hover:border-gray-600"
              }`}
            >
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
              type="button"
              key={r}
              onClick={() => set({ rounds: r })}
              aria-pressed={rounds === r}
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

      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Avance de turno</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={timerMode === "countdown"} onClick={() => set({ timerMode: "countdown", timePerTurn: [60, 120].includes(timePerTurn) ? timePerTurn : 60 })} className={`p-3 border text-sm ${timerMode === "countdown" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>Por tiempo</button>
          <button type="button" aria-pressed={timerMode === "manual"} onClick={() => set({ timerMode: "manual", turnStructure: "one_way" })} className={`p-3 border text-sm ${timerMode === "manual" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>Por entradas</button>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Sistema de votación</p>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" aria-pressed={value.votingSystem !== "patron" && value.votingSystem !== "free_vote"} onClick={() => set({ votingSystem: "rubrica" })} className={`p-3 border text-sm ${value.votingSystem !== "patron" && value.votingSystem !== "free_vote" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>Rúbrica</button>
          <button type="button" aria-pressed={value.votingSystem === "patron"} onClick={() => set({ votingSystem: "patron", timerMode: "manual" })} className={`p-3 border text-sm ${value.votingSystem === "patron" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>Por patrón</button>
          <button type="button" aria-pressed={value.votingSystem === "free_vote"} onClick={() => set({ votingSystem: "free_vote" })} className={`p-3 border text-sm ${value.votingSystem === "free_vote" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>Voto libre</button>
        </div>
      </div>

      {/* Tiempo por turno */}
      {timerMode === "countdown" && <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Tiempo por MC</p>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => set({ timePerTurn: t.value })}
              aria-pressed={timePerTurn === t.value}
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
      </div>}

      {timerMode === "countdown" && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Recorrido</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={turnStructure === "one_way"} onClick={() => set({ turnStructure: "one_way" })} className={`p-3 border text-left ${turnStructure === "one_way" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>
              <span className="block text-sm font-bold">Solo ida</span>
              <span className="mt-1 block text-xs text-gray-500">Un turno por MC</span>
            </button>
            <button type="button" aria-pressed={turnStructure === "round_trip"} onClick={() => set({ turnStructure: "round_trip" })} className={`p-3 border text-left ${turnStructure === "round_trip" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>
              <span className="block text-sm font-bold">Ida y vuelta</span>
              <span className="mt-1 block text-xs text-gray-500">Dos turnos completos por MC</span>
            </button>
          </div>
        </div>
      )}

      {timerMode === "manual" && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Entradas por MC</p>
          <div className="flex gap-2">
            {ENTRY_OPTIONS.map(entries => (
              <button type="button" key={entries} aria-pressed={entriesPerParticipant === entries} onClick={() => set({ entriesPerParticipant: entries })} className={`px-4 py-2 border text-sm ${entriesPerParticipant === entries ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>{entries}</button>
            ))}
          </div>
        </div>
      )}

      {/* Categoría (solo en modo clásico) */}
      {mode === "clasico" && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Categoría</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => set({ category: c.value === "aleatorio" ? undefined : c.value as WordCategory })}
                aria-pressed={(c.value === "aleatorio" && !category) || c.value === category}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                  (c.value === "aleatorio" && !category) || c.value === category
                    ? "border-red-500 bg-red-500/10 text-white"
                    : "border-gray-800 hover:border-gray-600 text-gray-400"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="border border-gray-800 p-3 text-xs text-gray-400">Los puntajes y resultados se muestran siempre al público.</p>
    </div>
  );
}
