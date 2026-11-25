"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, showToast } from "@/lib/utils";
import { BATTLE_PRESETS, type BattlePresetId } from "@freestyle/shared";
import { createBattle } from "@/lib/api";
import HeroSection from "@/components/HeroSection";

type Step = "menu" | "choose" | "create" | "join";

const PRESET_IDS = Object.keys(BATTLE_PRESETS) as BattlePresetId[];

export default function HomePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("menu");
  const [battleId, setBattleId] = useState("");
  const [alias, setAlias] = useState("");
  const [presetId, setPresetId] = useState<BattlePresetId>("rapida");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!alias.trim()) { showToast("Escribe tu alias primero", "error"); return; }
    setLoading(true);
    try {
      const battle = await createBattle(BATTLE_PRESETS[presetId].config);
      sessionStorage.setItem(`battle_pending_${battle.id}`, JSON.stringify({ alias: alias.trim(), role: "admin" }));
      router.push(`/battle/${battle.id}`);
    } catch {
      showToast("No se pudo crear la batalla. ¿Está el servidor corriendo?", "error");
      setLoading(false);
    }
  };

  const handleJoinBattle = () => {
    if (!battleId.trim()) { showToast("Escribe el código de sala", "error"); return; }
    if (!alias.trim()) { showToast("Escribe tu alias primero", "error"); return; }
    sessionStorage.setItem(`battle_pending_${battleId.toLowerCase()}`, JSON.stringify({ alias: alias.trim() }));
    router.push(`/battle/${battleId.toLowerCase()}`);
  };

  return (
    <div className="min-h-[calc(100vh-57px)] flex flex-col">
      <Toaster />

      {step === "menu" && (
        <HeroSection
          onJoin={() => setStep("join")}
          onCreate={() => setStep("choose")}
        />
      )}

      {step === "choose" && (
        <div className="max-w-lg mx-auto w-full px-4 py-12 animate-slide-up">
          <button onClick={() => setStep("menu")} className="text-gray-500 hover:text-white transition mb-8 flex items-center gap-1"><span>←</span> Volver</button>
          <h2 className="text-3xl font-battle text-white mb-2">Crear batalla</h2>
          <p className="text-gray-400 mb-8">Elige el tipo de experiencia</p>
          <div className="space-y-3">
            <button onClick={() => setStep("create")} className="w-full text-left p-5 rounded-2xl border-2 border-red-500/40 bg-red-500/5 hover:bg-red-500/10 transition">
              <span className="block font-battle text-xl font-black uppercase">1vs1</span>
              <span className="block text-sm text-gray-500 mt-1">Batalla individual entre dos MC</span>
            </button>
            <button onClick={() => router.push("/tournament")} className="w-full text-left p-5 rounded-2xl border-2 border-gray-800 hover:border-gray-600 transition">
              <span className="block font-battle text-xl font-black uppercase">Torneo</span>
              <span className="block text-sm text-gray-500 mt-1">Eliminatoria entre varios MC</span>
            </button>
            <button onClick={() => router.push("/tournament")} className="w-full text-left p-5 rounded-2xl border-2 border-gray-800 hover:border-gray-600 transition">
              <span className="block font-battle text-xl font-black uppercase">Rey de la pista</span>
              <span className="block text-sm text-gray-500 mt-1">El ganador se mantiene contra la fila</span>
            </button>
          </div>
        </div>
      )}

      {step === "create" && (
        <div className="max-w-lg mx-auto w-full px-4 py-12 animate-slide-up">
          <button onClick={() => setStep("choose")} className="text-gray-500 hover:text-white transition mb-8 flex items-center gap-1"><span>←</span> Volver</button>
          <h2 className="text-3xl font-battle text-white mb-8">Nueva batalla 1vs1</h2>

          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Tu AKA o nombre visible</label>
            <input type="text" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={24} placeholder="Ej: MC Lírico, Dtoke, Aczino..." className="w-full px-4 py-4 bg-arena-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-red-500 focus:outline-none text-lg" autoFocus />
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-3">Formato</p>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_IDS.map((id) => {
                const preset = BATTLE_PRESETS[id];
                return (
                  <button key={id} type="button" onClick={() => setPresetId(id)} aria-pressed={presetId === id} className={`p-3 rounded-xl border-2 text-left transition ${presetId === id ? "border-red-500 bg-red-500/10" : "border-gray-800 hover:border-gray-600"}`}>
                    <span className="block font-bold text-white text-sm">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-8 p-4 rounded-xl border border-gray-800 bg-black/40">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Resumen</p>
            <p className="text-sm text-white">{BATTLE_PRESETS[presetId].summary}</p>
          </div>

          <button onClick={handleCreate} disabled={loading || !alias.trim()} className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 rounded-xl font-bold text-white text-lg transition">
            {loading ? (<span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span> Creando sala...</span>) : "🎤 Crear Sala de Batalla"}
          </button>
        </div>
      )}

      {step === "join" && (
        <div className="max-w-lg mx-auto w-full px-4 py-12 animate-slide-up">
          <button onClick={() => setStep("menu")} className="text-gray-500 hover:text-white transition mb-8 flex items-center gap-1"><span>←</span> Volver</button>
          <h2 className="text-3xl font-battle text-white mb-8">Unirse a Batalla</h2>
          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-2">Código de sala</label>
            <input type="text" value={battleId} onChange={(e) => setBattleId(e.target.value.toLowerCase())} placeholder="Pega el código aquí" className="w-full px-4 py-5 bg-arena-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-red-500 focus:outline-none font-mono tracking-[0.3em] text-center text-2xl" maxLength={8} autoFocus />
          </div>
          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-2">Tu alias</label>
            <input type="text" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={24} placeholder="Ej: MC Lírico" className="w-full px-4 py-4 bg-arena-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-red-500 focus:outline-none text-lg" />
          </div>
          <button onClick={handleJoinBattle} disabled={!battleId.trim() || !alias.trim()} className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 rounded-xl font-bold text-white text-lg transition">🎧 Unirse a la Batalla</button>
        </div>
      )}
    </div>
  );
}
