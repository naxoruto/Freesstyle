"use client";

import type { BattleMode } from "@freestyle/shared";

const MODES: { mode: BattleMode; name: string; icon: string; desc: string }[] = [
  { mode: "clasico", name: "Clásico", icon: "🎤", desc: "1 palabra cada 45s, alternando turnos" },
  { mode: "contrarreloj", name: "Contrarreloj", icon: "⏱️", desc: "Palabra nueva sin pausa" },
  { mode: "tematico", name: "Temático", icon: "🎯", desc: "Todas las palabras de una categoría" },
  { mode: "muerte-subita", name: "Muerte Súbita", icon: "💀", desc: "Sin límite, pierde el que falla" },
  { mode: "por-equipos", name: "Por Equipos", icon: "👥", desc: "2vs2 o más, rounds por equipo" },
];

interface BattleModeSelectorProps {
  value: BattleMode;
  onChange: (mode: BattleMode) => void;
}

export function BattleModeSelector({ value, onChange }: BattleModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {MODES.map(({ mode, name, icon, desc }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            value === mode
              ? "border-red-500 bg-red-500/10"
              : "border-gray-800 bg-arena-800/30 hover:border-gray-600"
          }`}
        >
          <span className="text-2xl block mb-1">{icon}</span>
          <span className="font-bold text-white text-sm">{name}</span>
          <p className="text-xs text-gray-500 mt-1">{desc}</p>
        </button>
      ))}
    </div>
  );
}
