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

const CRITERIA: { key: keyof ScoreRubric; label: string; short: string }[] = [
  { key: "flow",      label: "Flow / Métrica",      short: "Flow"     },
  { key: "lirica",    label: "Lírica / Contenido",   short: "Lírica"   },
  { key: "ingenio",   label: "Ingenio",              short: "Ingenio"  },
  { key: "presencia", label: "Puesta en Escena",     short: "Escena"   },
  { key: "tecnica",   label: "Técnica Vocal",        short: "Técnica"  },
];

export function RubricPanel({ participantName, onSubmit, submitted, externalScores, onScoresChange, submitLabel, hideSubmit, compact }: RubricPanelProps) {
  const [internalScores, setInternalScores] = useState<ScoreRubric>({
    flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5,
  });

  const scores = externalScores ?? internalScores;

  const updateScore = (key: keyof ScoreRubric, value: number) => {
    const next = { ...scores, [key]: value };
    if (onScoresChange) onScoresChange(next);
    else setInternalScores(next);
  };

  const totalScore = scores.flow + scores.lirica + scores.ingenio + scores.presencia + scores.tecnica;

  return (
    <div className={`border border-white/8 ${compact ? "p-3" : "p-5"}`} style={{ background: "rgba(255,255,255,0.02)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-white/30">Rúbrica</p>
        {participantName && (
          <p className="font-battle font-black italic uppercase text-sm" style={{ color: "#e30613" }}>
            {participantName}
          </p>
        )}
      </div>

      {/* Criteria */}
      <div className={compact ? "space-y-3" : "space-y-4"}>
        {CRITERIA.map(({ key, label, short }) => (
          <div key={key}>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
                {compact ? short : label}
              </span>
              <span className="text-xs font-black font-battle italic" style={{ color: "#e30613" }}>
                {scores[key]}<span className="text-white/20">/10</span>
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={scores[key]}
              onChange={(e) => updateScore(key, Number(e.target.value))}
              className="w-full h-1 rounded-none appearance-none cursor-pointer"
              style={{ accentColor: "#e30613", background: "rgba(255,255,255,0.08)" }}
            />
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-baseline justify-between">
        <span className="text-xs text-white/30 tracking-widest uppercase">Total</span>
        <div>
          <span className="font-battle font-black italic text-2xl" style={{ color: "#e30613" }}>{totalScore}</span>
          <span className="text-xs text-white/20 ml-1">/ 50</span>
        </div>
      </div>

      {!hideSubmit && (
        <button
          onClick={() => onSubmit(scores)}
          disabled={!participantName || submitted}
          className="w-full mt-3 py-3 font-battle font-black italic uppercase tracking-wider text-sm transition-all"
          style={{
            background: submitted ? "rgba(255,255,255,0.05)" : "#e30613",
            color: submitted ? "rgba(255,255,255,0.3)" : "white",
            cursor: submitted ? "default" : "pointer",
          }}
        >
          {submitted ? "Puntuación enviada" : submitLabel || "Enviar Puntuación"}
        </button>
      )}
    </div>
  );
}
