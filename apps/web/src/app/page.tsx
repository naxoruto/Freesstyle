"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, showToast } from "@/lib/utils";
import { BATTLE_PRESETS, matchPreset, type BattlePresetId, type BattleModeConfig } from "@freestyle/shared";
import { createBattle } from "@/lib/api";
import HeroSection from "@/components/HeroSection";
import { BattleModeSelector } from "@/components/BattleModeSelector";
import { Button, Panel, TextField } from "@/components/ui";

type Step = "menu" | "choose" | "create" | "join";

const PRESET_IDS = Object.keys(BATTLE_PRESETS) as BattlePresetId[];

export default function HomePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("menu");
  const [battleId, setBattleId] = useState("");
  const [alias, setAlias] = useState("");
  const [config, setConfig] = useState<BattleModeConfig>(BATTLE_PRESETS.rapida.config);
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const matchedPreset = matchPreset(config);

  const handleCreate = async () => {
    if (!alias.trim()) { showToast("Escribe tu alias primero", "error"); return; }
    setLoading(true);
    try {
      const battle = await createBattle(config);
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

  const handlePresetSelect = (id: BattlePresetId) => {
    setConfig(BATTLE_PRESETS[id].config);
  };

  const handleConfigChange = (partial: Partial<BattleModeConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
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
          <Button variant="ghost" size="sm" onClick={() => setStep("menu")} className="mb-8"><span aria-hidden="true">←</span> Volver</Button>
          <h2 className="text-3xl font-battle text-white mb-2">Crear batalla</h2>
          <p className="text-gray-400 mb-8">Elige el tipo de experiencia</p>
          <div className="space-y-3">
            <Button variant="option" fullWidth onClick={() => setStep("create")}>
              <span className="block font-battle text-xl font-black uppercase">1vs1</span>
              <span className="block text-sm text-gray-500 mt-1">Batalla individual entre dos MC</span>
            </Button>
            <Button variant="option" fullWidth onClick={() => router.push("/tournament")}>
              <span className="block font-battle text-xl font-black uppercase">Torneo</span>
              <span className="block text-sm text-gray-500 mt-1">Eliminatoria entre varios MC</span>
            </Button>
            <Button variant="option" fullWidth onClick={() => router.push("/tournament")}>
              <span className="block font-battle text-xl font-black uppercase">Rey de la pista</span>
              <span className="block text-sm text-gray-500 mt-1">El ganador se mantiene contra la fila</span>
            </Button>
          </div>
        </div>
      )}

      {step === "create" && (
        <div className="max-w-lg mx-auto w-full px-4 py-12 animate-slide-up">
          <Button variant="ghost" size="sm" onClick={() => setStep("choose")} className="mb-8"><span aria-hidden="true">←</span> Volver</Button>
          <h2 className="text-3xl font-battle text-white mb-8">Nueva batalla 1vs1</h2>

          <div className="mb-6">
            <TextField label="Tu AKA o nombre visible" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={24} placeholder="Ej: MC Lírico, Dtoke, Aczino..." size="lg" autoFocus />
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400">Formato</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCustomOpen(open => !open)}>{customOpen ? "Cerrar" : "Cambiar formato"}</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_IDS.map((id) => {
                const preset = BATTLE_PRESETS[id];
                return (
                  <Button key={id} type="button" variant="option" size="sm" aria-pressed={matchedPreset === id} onClick={() => handlePresetSelect(id)} className="h-full">
                    <span className="block font-bold text-white text-sm">{preset.name}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {customOpen && (
            <Panel className="mb-6">
              <BattleModeSelector value={config} onChange={handleConfigChange} />
            </Panel>
          )}

          <Panel className="mb-8">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{matchedPreset ? "Resumen" : "Formato personalizado"}</p>
            <p className="text-sm text-white">{matchedPreset ? BATTLE_PRESETS[matchedPreset].summary : "Ajustaste las reglas a tu medida."}</p>
          </Panel>

          <Button onClick={handleCreate} disabled={loading || !alias.trim()} fullWidth size="lg">
            {loading ? (<span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span> Creando sala...</span>) : "🎤 Crear Sala de Batalla"}
          </Button>
        </div>
      )}

      {step === "join" && (
        <div className="max-w-lg mx-auto w-full px-4 py-12 animate-slide-up">
          <Button variant="ghost" size="sm" onClick={() => setStep("menu")} className="mb-8"><span aria-hidden="true">←</span> Volver</Button>
          <h2 className="text-3xl font-battle text-white mb-8">Unirse a Batalla</h2>
          <div className="mb-8">
            <TextField label="Código de sala" type="text" value={battleId} onChange={(e) => setBattleId(e.target.value.toLowerCase())} placeholder="Pega el código aquí" size="lg" controlClassName="text-center font-mono text-2xl tracking-[0.3em]" maxLength={8} autoFocus />
          </div>
          <div className="mb-8">
            <TextField label="Tu alias" type="text" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={24} placeholder="Ej: MC Lírico" size="lg" />
          </div>
          <Button onClick={handleJoinBattle} disabled={!battleId.trim() || !alias.trim()} fullWidth size="lg">🎧 Unirse a la Batalla</Button>
        </div>
      )}
    </div>
  );
}
