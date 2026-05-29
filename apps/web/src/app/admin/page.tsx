"use client";

import { useState, useEffect } from "react";
import type { Battle } from "@freestyle/shared";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

export default function AdminPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${WS_URL}/api/battles`)
      .then((r) => r.json())
      .then(setBattles)
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetch(`${WS_URL}/api/battles`)
        .then((r) => r.json())
        .then(setBattles);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-battle text-white">🛡️ Admin Panel</h1>
        <a
          href="/"
          className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-white transition"
        >
          + Nueva Batalla
        </a>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Cargando...</div>
      ) : battles.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">🎤</span>
          <p className="text-gray-500 text-lg">No hay batallas activas</p>
          <p className="text-gray-600 text-sm mt-1">Crea una desde la página principal</p>
        </div>
      ) : (
        <div className="space-y-4">
          {battles.map((battle) => (
            <div
              key={battle.id}
              className="p-6 rounded-2xl border border-gray-800 bg-arena-800/30 hover:border-red-500/30 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-mono text-red-400">{battle.id}</h3>
                  <p className="text-sm text-gray-500">
                    Modo: {battle.mode.mode} · Ronda {battle.currentRound}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    battle.status === "in_progress"
                      ? "bg-green-500/20 text-green-400"
                      : battle.status === "finished"
                      ? "bg-gray-500/20 text-gray-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {battle.status}
                  </span>
                  <a
                    href={`/battle/${battle.id}?role=admin&alias=Admin`}
                    className="text-sm text-blue-400 hover:underline"
                  >
                    Entrar →
                  </a>
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-xs text-gray-600">
                <span>{battle.participants.length} participantes</span>
                <span>{battle.judges.length} jueces</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
