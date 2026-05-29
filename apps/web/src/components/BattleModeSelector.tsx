"use client";

/**
 * BattleModeSelector — Modo único: Clásico con Rúbrica.
 *
 * A diferencia de solo ver un video en YouTube, Freestyle Arena ofrece:
 *  🔴 Jueceo en tiempo real con rúbrica (Flow, Lírica, Ingenio, Presencia, Técnica)
 *  🎲 Palabras aleatorias generadas por el sistema
 *  ⏱️ Cronómetro y fases automatizadas
 *  📊 Resultados transparentes voto por voto
 */

const MODE_INFO = {
  mode: "clasico" as const,
  name: "Clásico",
  icon: "🎤",
  desc: "1vs1 · 3 rondas · 45s por turno · Jueceo con rúbrica",
  highlights: [
    { icon: "📋", label: "Rúbrica de 5 criterios", detail: "Flow, Lírica, Ingenio, Presencia, Técnica" },
    { icon: "🎲", label: "Palabras aleatorias", detail: "8 categorías, 3 niveles de dificultad" },
    { icon: "⏱️", label: "Cronómetro en vivo", detail: "45s por turno con cuenta regresiva" },
    { icon: "⚖️", label: "Votación en tiempo real", detail: "Los jueces deciden ronda por ronda" },
  ],
};

export function BattleModeSelector() {
  return (
    <div className="p-5 rounded-2xl border-2 border-red-500/30 bg-red-500/5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{MODE_INFO.icon}</span>
        <div>
          <span className="font-battle text-xl text-white">{MODE_INFO.name}</span>
          <p className="text-sm text-gray-400">{MODE_INFO.desc}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MODE_INFO.highlights.map((h) => (
          <div key={h.label} className="flex items-start gap-2 p-2 rounded-lg bg-arena-900/40">
            <span className="text-lg">{h.icon}</span>
            <div>
              <p className="text-xs font-bold text-gray-300">{h.label}</p>
              <p className="text-xs text-gray-500">{h.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
