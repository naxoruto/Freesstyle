"use client";

import { useState } from "react";
import type { ScoreRubric } from "@freestyle/shared";

interface RubricPanelProps {
  participantName: string | undefined;
  onSubmit: (scores: ScoreRubric) => void;
  submitted: boolean;
}

const CRITERIA: { key: keyof ScoreRubric; label: string; emoji: string; description: string }[] = [
  { key: "flow", label: "Flow / Métrica", emoji: "🌊", description: "Ritmo, cadencia y compás" },
  { key: "lirica", label: "Lírica / Contenido", emoji: "📝", description: "Calidad de las rimas y mensaje" },
  { key: "ingenio", label: "Ingenio / Creatividad", emoji: "💡", description: "Originalidad e improvisación" },
  { key: "presencia", label: "Puesta en Escena", emoji: "🎭", description: "Actitud, presencia y energía" },
  { key: "tecnica", label: "Técnica Vocal", emoji: "🗣️", description: "Respiración, vocalización, claridad" },
];

export function RubricPanel({ participantName, onSubmit, submitted }: RubricPanelProps) {
  const [scores, setScores] = useState<ScoreRubric>({
    flow: 5,
    lirica: 5,
    ingenio: 5,
    presencia: 5,
    tecnica: 5,
  });

  const updateScore = (key: keyof ScoreRubric, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const average = Math.round(
    (Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length) * 10
  ) / 10;

  return (
    <div className="p-6 rounded-2xl border border-gray-800 bg-arena-800/30">
      <h3 className="font-battle text-white mb-1">📋 Rúbrica de Puntuación</h3>
      {participantName && (
        <p className="text-sm text-yellow-400 mb-4">
          Puntuando a: <span className="font-bold">{participantName}</span>
        </p>
      )}

      <div className="space-y-5">
        {CRITERIA.map(({ key, label, emoji, description }) => (
          <div key={key}>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-300">
                {emoji} {label}
              </span>
              <span className="text-sm font-mono font-bold text-red-400">
                {scores[key]}/10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={scores[key]}
              onChange={(e) => updateScore(key, Number(e.target.value))}
              className="w-full h-2 bg-arena-800 rounded-lg appearance-none cursor-pointer
                         accent-red-500 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5"
            />
            <p className="text-xs text-gray-600 mt-0.5">{description}</p>
          </div>
        ))}
      </div>

      {/* Promedio */}
      <div className="mt-6 p-4 rounded-xl bg-arena-900/50 text-center">
        <span className="text-sm text-gray-500">Promedio: </span>
        <span className="text-2xl font-battle text-yellow-400">{average}</span>
        <span className="text-sm text-gray-500"> / 10</span>
      </div>

      {/* Botón enviar */}
      <button
        onClick={() => onSubmit(scores)}
        disabled={!participantName || submitted}
        className="w-full mt-4 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 
                   disabled:bg-gray-700 disabled:text-gray-500
                   rounded-lg font-bold text-white transition"
      >
        {submitted ? "✅ Puntuación enviada" : "📤 Enviar Puntuación"}
      </button>
    </div>
  );
}
