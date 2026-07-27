"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, useClipboard, showToast } from "@/lib/utils";
import type { UserRole, BattleModeConfig } from "@freestyle/shared";
import HeroSection from "@/components/HeroSection";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

type Step = "menu" | "create" | "created" | "join";

export default function HomePage() {
  const router = useRouter();
  const { copied, copy } = useClipboard();

  const [step, setStep] = useState<Step>("menu");
  const [battleId, setBattleId] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [role, setRole] = useState<UserRole>("participant");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [modeConfig] = useState<Partial<BattleModeConfig>>({ mode: "clasico", rounds: 3, timePerTurn: 60, showScoresToSpectators: true, turnStructure: "one_way" });

  const handleCreate = async () => {
    if (!alias.trim()) { showToast("Escribe tu alias primero", "error"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${WS_URL}/api/battles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: modeConfig }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      const battle = await res.json();
      setCreatedId(battle.id);
      setAdminToken(battle.adminToken);
      setStep("created");
      showToast("¡Batalla creada!", "success");
    } catch {
      showToast("No se pudo crear la batalla. ¿Está el servidor corriendo?", "error");
    }
    setLoading(false);
  };

  const handleJoinBattle = () => {
    if (!battleId.trim()) { showToast("Escribe el código de sala", "error"); return; }
    if (!alias.trim()) { showToast("Escribe tu alias primero", "error"); return; }
    router.push(`/battle/${battleId.toLowerCase()}?role=${role}&alias=${encodeURIComponent(alias)}`);
  };

  const enterCreated = () => {
    if (!alias.trim()) { showToast("Escribe tu alias primero", "error"); return; }
    // El creador SIEMPRE es admin. El rol extra (participante/juez) va como alsoAs
    router.push(`/battle/${createdId}?role=admin&alsoAs=${role}&alias=${encodeURIComponent(alias)}&adminToken=${encodeURIComponent(adminToken)}`);
  };

  return (
    <div className="min-h-[calc(100vh-57px)] flex flex-col">
      <Toaster />

      {step === "menu" && (
        <HeroSection
          onJoin={() => setStep("join")}
          onCreate={() => setStep("create")}
        />
      )}

      {step === "create" && (
        <div className="max-w-lg mx-auto w-full px-4 py-12 animate-slide-up">
          <button onClick={() => setStep("menu")} className="text-gray-500 hover:text-white transition mb-8 flex items-center gap-1"><span>←</span> Volver</button>
          <h2 className="text-3xl font-battle text-white mb-8">Nueva Batalla</h2>
          <div className="mb-8">
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-2"><span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center justify-center font-bold">1</span>Tu alias de MC</label>
            <input type="text" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: MC Lírico, Dtoke, Aczino..." className="w-full px-4 py-4 bg-arena-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-red-500 focus:outline-none text-lg" autoFocus />
          </div>
          <div className="mb-8">
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-2"><span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center justify-center font-bold">2</span>También quieres participar como</label>
            <p className="text-xs text-gray-600 mb-3">Eres el admin de la sala. Opcionalmente puedes también ser MC o juez.</p>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setRole("participant")} className={`p-4 rounded-xl border-2 text-center transition ${role === "participant" ? "border-red-500 bg-red-500/10" : "border-gray-800 hover:border-gray-600"}`}><span className="text-2xl block mb-1">🎤</span><span className="font-bold text-white text-sm">MC (participante)</span></button>
              <button onClick={() => setRole("judge")} className={`p-4 rounded-xl border-2 text-center transition ${role === "judge" ? "border-yellow-500 bg-yellow-500/10" : "border-gray-800 hover:border-gray-600"}`}><span className="text-2xl block mb-1">⚖️</span><span className="font-bold text-white text-sm">Juez</span></button>
              <button onClick={() => setRole("spectator")} className={`p-4 rounded-xl border-2 text-center transition ${role === "spectator" ? "border-blue-500 bg-blue-500/10" : "border-gray-800 hover:border-gray-600"}`}><span className="text-2xl block mb-1">👁️</span><span className="font-bold text-white text-sm">Público</span></button>
            </div>
          </div>
          <button onClick={handleCreate} disabled={loading || !alias.trim()} className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 rounded-xl font-bold text-white text-lg transition">
            {loading ? (<span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span> Creando sala...</span>) : "🎤 Crear Sala de Batalla"}
          </button>
        </div>
      )}

      {step === "created" && (
        <div className="max-w-lg mx-auto w-full px-4 py-12 text-center animate-bounce-in">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-battle text-white mb-2">¡Sala creada!</h2>
          <p className="text-gray-400 mb-8">Comparte este código con los participantes y jueces</p>
          <div className="mb-8">
            <button onClick={() => copy(createdId)} className="group w-full p-6 rounded-2xl border-2 border-dashed border-red-500/40 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500 transition-all">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest">Código de sala</p>
              <p className="text-5xl font-mono font-bold text-red-400 tracking-[0.3em] group-hover:scale-105 transition-transform">{createdId}</p>
              <p className="text-sm text-gray-500 mt-3 flex items-center justify-center gap-1">{copied ? "✅ Copiado" : "📋 Clic para copiar"}</p>
            </button>
          </div>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Eres el <span className="text-red-400 font-bold">admin</span> de esta sala.</p>
            <button onClick={enterCreated} disabled={!alias.trim()} className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 rounded-xl font-bold text-white text-lg transition">🚀 Entrar a la Sala</button>
            <button onClick={() => setStep("menu")} className="w-full py-3 text-gray-500 hover:text-white transition text-sm">← Volver al inicio</button>
          </div>
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
            <input type="text" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej: MC Lírico" className="w-full px-4 py-4 bg-arena-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-red-500 focus:outline-none text-lg" />
          </div>
          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-2">Entrar como</label>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setRole("participant")} className={`p-4 rounded-xl border-2 text-center transition ${role === "participant" ? "border-red-500 bg-red-500/10" : "border-gray-800 hover:border-gray-600"}`}><span className="text-2xl block mb-1">🎤</span><span className="font-bold text-white text-sm">Participante</span></button>
              <button onClick={() => setRole("judge")} className={`p-4 rounded-xl border-2 text-center transition ${role === "judge" ? "border-yellow-500 bg-yellow-500/10" : "border-gray-800 hover:border-gray-600"}`}><span className="text-2xl block mb-1">⚖️</span><span className="font-bold text-white text-sm">Juez</span></button>
              <button onClick={() => setRole("spectator")} className={`p-4 rounded-xl border-2 text-center transition ${role === "spectator" ? "border-blue-500 bg-blue-500/10" : "border-gray-800 hover:border-gray-600"}`}><span className="text-2xl block mb-1">👁️</span><span className="font-bold text-white text-sm">Público</span></button>
            </div>
          </div>
          <button onClick={handleJoinBattle} disabled={!battleId.trim() || !alias.trim()} className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 rounded-xl font-bold text-white text-lg transition">🎧 Unirse a la Batalla</button>
        </div>
      )}
    </div>
  );
}
