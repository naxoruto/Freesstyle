"use client";

import { useState } from "react";
import type { ScoreRubric } from "@freestyle/shared";

interface RubricPanelProps {
  participantName: string | undefined;
  onSubmit: (scores: ScoreRubric) => void;
  submitted: boolean;
  externalScores?: ScoreRubric;
  onScoresChange?: (scores: ScoreRubric) => void;
  submitLabel?: string;
  hideSubmit?: boolean;
  compact?: boolean;
}

const CRITERIA: { key: keyof ScoreRubric; label: string; emoji: string; description: string }[] = [
  { key: "flow", label: "Flow / Métrica", emoji: "🌊", description: "Ritmo, cadencia y compás" },
  { key: "lirica", label: "Lírica / Contenido", emoji: "📝", description: "Calidad de las rimas y mensaje" },
  { key: "ingenio", label: "Ingenio / Creatividad", emoji: "💡", description: "Originalidad e improvisación" },
  { key: "presencia", label: "Puesta en Escena", emoji: "🎭", description: "Actitud, presencia y energía" },
  { key: "tecnica", label: "Técnica Vocal", emoji: "🗣️", description: "Respiración, vocalización, claridad" },
];

export function RubricPanel({ participantName, onSubmit, submitted, externalScores, onScoresChange, submitLabel, hideSubmit, compact }: RubricPanelProps) {
  const [internalScores, setInternalScores] = useState<ScoreRubric>({
    flow: 5,
    lirica: 5,
    ingenio: 5,
    presencia: 5,
    tecnica: 5,
  });

  const scores = externalScores ?? internalScores;

  const updateScore = (key: keyof ScoreRubric, value: number) => {
    const newScores = { ...scores, [key]: value };
    if (onScoresChange) {
      onScoresChange(newScores);
    } else {
      setInternalScores(newScores);
    }
  };

  const average = Math.round(
    (Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length) * 10
  ) / 10;

  const totalScore = scores.flow + scores.lirica + scores.ingenio + scores.presencia + scores.tecnica;

  return (
    <div className={`rounded-2xl border border-gray-800 bg-arena-800/30 ${compact ? "p-3" : "p-6"}`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className={`font-battle text-white ${compact ? "text-sm" : ""}`}>📋 Rúbrica</h3>
        {participantName && (
          <p className={`text-yellow-400 font-bold ${compact ? "text-xs" : "text-sm"}`}>
            {participantName}
          </p>
        )}
      </div>

      <div className={`${compact ? "space-y-2" : "space-y-5"}`}>
        {CRITERIA.map(({ key, label, emoji, description }) => (
          <div key={key}>
            <div className="flex justify-between mb-1">
              <span className={`text-gray-300 ${compact ? "text-xs" : "text-sm"}`}>
                {emoji} {compact ? key : label}
              </span>
              <span className={`font-mono font-bold text-red-400 ${compact ? "text-xs" : "text-sm"}`}>
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
            {!compact && <p className="text-xs text-gray-600 mt-0.5">{description}</p>}
          </div>
        ))}
      </div>

      {/* Total + promedio */}
      <div className={`mt-4 p-3 rounded-xl bg-arena-900/50 text-center ${compact ? "p-2" : "p-4"}`}>
        <span className={`text-gray-500 ${compact ? "text-xs" : "text-sm"}`}>Total: </span>
        <span className={`font-battle text-yellow-400 ${compact ? "text-lg" : "text-2xl"}`}>{totalScore}</span>
        <span className={`text-gray-500 ${compact ? "text-xs" : "text-sm"}`}> / 50</span>
        <span className={`text-gray-600 mx-1 ${compact ? "text-xs" : "text-sm"}`}>·</span>
        <span className={`text-gray-500 ${compact ? "text-xs" : "text-sm"}`}>Prom: </span>
        <span className={`font-battle text-yellow-400 ${compact ? "text-sm" : "text-lg"}`}>{average}</span>
      </div>

      {/* Botón enviar — solo visible si no está oculto */}
      {!hideSubmit && (
        <button
          onClick={() => onSubmit(scores)}
          disabled={!participantName || submitted}
          className="w-full mt-3 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 
                     disabled:bg-gray-700 disabled:text-gray-500
                     rounded-lg font-bold text-white transition text-sm"
        >
          {submitted ? "✅ Puntuación enviada" : submitLabel || "📤 Enviar Puntuación"}
        </button>
      )}
    </div>
  );
}
