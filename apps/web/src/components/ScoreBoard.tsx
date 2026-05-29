"use client";

import type { Participant } from "@freestyle/shared";

interface ScoreBoardProps {
  participants: Participant[];
  currentTurn: string;
  userId: string;
}

export function ScoreBoard({ participants, currentTurn, userId }: ScoreBoardProps) {
  if (participants.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-gray-800 bg-arena-800/30 text-center">
        <p className="text-gray-600">Esperando participantes...</p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl border border-gray-800 bg-arena-800/30">
      <h3 className="font-battle text-lg text-white mb-4">🏆 Participantes</h3>
      <div className="space-y-3">
        {participants.map((p) => {
          const isActive = p.userId === currentTurn;
          const isMe = p.userId === userId;

          return (
            <div
              key={p.userId}
              className={`flex items-center justify-between p-3 rounded-xl transition border ${
                isActive
                  ? "border-red-500 bg-red-500/10"
                  : "border-transparent bg-arena-900/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-2xl ${isActive ? "animate-bounce" : ""}`}>
                  {isActive ? "🎤" : "🎧"}
                </span>
                <div>
                  <p className="font-bold text-white">
                    {p.alias} {isMe && <span className="text-xs text-gray-500">(tú)</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    Rondas ganadas: {p.roundsWon}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {isActive && (
                  <span className="text-xs text-red-400 animate-pulse font-bold">
                    RAPEANDO
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
