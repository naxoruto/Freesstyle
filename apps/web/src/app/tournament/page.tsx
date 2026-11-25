"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Tournament, TournamentType } from "@freestyle/shared";

const API_URL = process.env.NEXT_PUBLIC_WS_URL || "";

type Step = "form" | "setup" | "active";

export default function TournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("MC Uno\nMC Dos\nMC Tres\nMC Cuatro");
  const [random, setRandom] = useState(true);
  const [type, setType] = useState<TournamentType>("single_elimination");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [adminToken, setAdminToken] = useState("");

  const handleCreate = async () => {
    const participants = aliases.split("\n").map(alias => alias.trim()).filter(Boolean);
    if (!name.trim() || participants.length < 4 || (participants.length & (participants.length - 1)) !== 0) {
      setError("Escribe un nombre y 4, 8, 16... participantes, uno por línea.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const createResponse = await fetch(`${API_URL}/api/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bracketMode: random ? "random" : "manual", type, participants }),
      });
      if (!createResponse.ok) throw new Error("No se pudo crear el torneo");
      const created = await createResponse.json();
      setAdminToken(created.adminToken);

      setTournament(created.tournament);
      setStep("setup");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!tournament) return;
    setLoading(true);
    try {
      const startResponse = await fetch(`${API_URL}/api/tournaments/${tournament.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken }),
      });
      if (!startResponse.ok) throw new Error("No se pudo generar el bracket");
      setTournament(await startResponse.json());
      setStep("active");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!tournament) return;
    const target = index + direction;
    if (target < 0 || target >= tournament.participants.length) return;
    const previous = tournament.participants;
    const reordered = [...previous];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setError("");
    setTournament({ ...tournament, participants: reordered });
    const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/participants/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminToken, orderedIds: reordered.map(participant => participant.userId) }),
    });
    if (!response.ok) {
      setTournament({ ...tournament, participants: previous });
      setError("No se pudo actualizar el orden");
    }
  };

  const openBattle = async (battleId: string) => {
    if (!tournament) return;
    const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/battles/${battleId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminToken }),
    });
    if (!response.ok) { setError("No se pudo abrir la sala"); return; }
    const access = await response.json();
    sessionStorage.setItem(`battle_admin_${battleId}`, access.adminToken);
    sessionStorage.setItem(`battle_pending_${battleId}`, JSON.stringify({ alias: "Host" }));
    sessionStorage.setItem(`battle_return_${battleId}`, JSON.stringify({ returnTo: "tournament", tournamentId: tournament.id }));
    router.push(`/battle/${battleId}`);
  };

  const registerWinner = async (battleId: string, winnerId: string) => {
    if (!tournament) return;
    const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/winners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminToken, battleId, winnerId }),
    });
    if (!response.ok) { setError("No se pudo registrar el ganador"); return; }
    setTournament(await response.json());
  };

  const renderBattle = (match: { battleId?: string; mc1Id?: string; mc2Id?: string; winnerId?: string }) => {
    const p1 = tournament?.participants.find(p => p.userId === match.mc1Id);
    const p2 = tournament?.participants.find(p => p.userId === match.mc2Id);
    return (
      <div className="border border-white/5 p-4 text-sm">
        <p>{p1?.alias ?? "Por definir"}</p>
        <p className="my-1 text-xs text-red-500">VS</p>
        <p>{p2?.alias ?? "Por definir"}</p>
        {match.battleId && (
          <button onClick={() => openBattle(match.battleId!)} className="mt-3 block text-xs uppercase tracking-wider text-red-400">Abrir sala {match.battleId}</button>
        )}

        {match.battleId && !match.winnerId && p1 && p2 && (
          <div className="mt-3 flex gap-2">
            <button onClick={() => registerWinner(match.battleId!, p1.userId)} className="border border-white/10 px-2 py-1 text-xs">Ganó {p1.alias}</button>
            <button onClick={() => registerWinner(match.battleId!, p2.userId)} className="border border-white/10 px-2 py-1 text-xs">Ganó {p2.alias}</button>
          </div>
        )}
        {match.winnerId && <p className="mt-3 text-xs uppercase text-green-400">Ganador registrado</p>}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <a href="/" className="text-gray-500 hover:text-white transition mb-4 flex items-center gap-1 text-sm">
        <span>←</span> Volver al inicio
      </a>
      <p className="text-xs uppercase tracking-[0.3em] text-red-500">Formato eliminatorio</p>
      <h1 className="mt-2 font-battle text-5xl font-black uppercase italic">Torneos</h1>

      {step === "form" && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 border border-white/10 p-5">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del torneo" className="w-full border border-white/10 bg-black p-3" />
            <textarea value={aliases} onChange={e => setAliases(e.target.value)} rows={10} className="w-full border border-white/10 bg-black p-3 font-mono text-sm" />
            <label className="flex items-center gap-3 text-sm text-white/50">
              <input type="checkbox" checked={random} onChange={e => setRandom(e.target.checked)} className="accent-red-600" />
              Emparejamientos aleatorios
            </label>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Tipo de torneo</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <button type="button" onClick={() => setType("single_elimination")} aria-pressed={type === "single_elimination"} className={`p-3 border text-sm text-left ${type === "single_elimination" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>
                  <span className="block font-bold">Eliminación directa</span>
                  <span className="text-xs text-gray-500">El que pierde queda fuera</span>
                </button>
                <button type="button" onClick={() => setType("with_third_place")} aria-pressed={type === "with_third_place"} className={`p-3 border text-sm text-left ${type === "with_third_place" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>
                  <span className="block font-bold">Con tercer puesto</span>
                  <span className="text-xs text-gray-500">Partido extra por el 3er lugar</span>
                </button>
                <button type="button" onClick={() => setType("king_of_the_hill")} aria-pressed={type === "king_of_the_hill"} className={`p-3 border text-sm text-left ${type === "king_of_the_hill" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>
                  <span className="block font-bold">Rey de la pista</span>
                  <span className="text-xs text-gray-500">El ganador permanece contra la fila</span>
                </button>
                <button type="button" onClick={() => setType("double_elimination")} aria-pressed={type === "double_elimination"} className={`p-3 border text-sm text-left ${type === "double_elimination" ? "border-red-500 text-white" : "border-gray-800 text-gray-400"}`}>
                  <span className="block font-bold">Con repesca</span>
                  <span className="text-xs text-gray-500">Dos derrotas eliminan</span>
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={handleCreate} disabled={loading} className="w-full bg-red-600 py-3 font-battle font-black uppercase disabled:opacity-40">
              {loading ? "Creando..." : "Crear torneo"}
            </button>
          </div>
          <div className="border border-white/5 p-5 text-sm leading-7 text-white/40">
            <p>Participantes permitidos: 4, 8, 16 o 32. La repesca soporta cuadros de 4, 8 y 16.</p>
            <p>Cada enfrentamiento crea una sala de batalla normal.</p>
            <p>Podrás revisar el bracket antes de iniciar el torneo.</p>
          </div>
        </div>
      )}

      {step === "setup" && tournament && (
        <div className="mt-8 space-y-6">
          <div className="border border-white/10 p-5">
            <h2 className="font-battle text-2xl font-black uppercase mb-4">{tournament.name}</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-4">Participantes ({tournament.participants.length})</p>
            {tournament.bracketMode === "manual" ? (
              <div className="space-y-2">
                {tournament.participants.map((participant, index) => (
                  <div key={participant.userId} className="flex items-center gap-2 border border-white/10 p-2 text-sm text-white/60">
                    <span className="text-xs text-white/20 w-6 text-right">{index + 1}.</span>
                    <span className="flex-1">{participant.alias}</span>
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      aria-label={`Subir a ${participant.alias}`}
                      className="border border-white/10 w-8 h-8 text-white/50 hover:text-white hover:border-white/30 disabled:opacity-20"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === tournament.participants.length - 1}
                      aria-label={`Bajar a ${participant.alias}`}
                      className="border border-white/10 w-8 h-8 text-white/50 hover:text-white hover:border-white/30 disabled:opacity-20"
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {tournament.participants.map((p, i) => (
                  <div key={p.userId} className="border border-white/10 p-2 text-sm text-white/60">
                    <span className="text-xs text-white/20 mr-1">{i + 1}.</span>
                    {p.alias}
                  </div>
                ))}
              </div>
            )}
          </div>
          {tournament.bracketMode === "manual" && tournament.type === "king_of_the_hill" && (
            <div className="border border-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-3">Orden de la pista</p>
              <div className="border border-red-500/30 p-3 text-sm text-white/70">
                <span className="font-bold text-white">Duelo inicial:</span> {tournament.participants[0]?.alias ?? "?"}
                <span className="text-red-500 font-black mx-2">vs</span>
                {tournament.participants[1]?.alias ?? "?"}
              </div>
              <p className="mt-3 text-xs text-white/40">
                Fila de retadores: {tournament.participants.slice(2).map(participant => participant.alias).join(" → ")}
              </p>
            </div>
          )}
          {tournament.bracketMode === "manual" && tournament.type !== "king_of_the_hill" && (
            <div className="border border-white/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-3">Enfrentamientos</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: Math.floor(tournament.participants.length / 2) }, (_, index) => (
                  <div key={index} className="border border-white/5 p-2 text-sm text-white/60">
                    {tournament.participants[index * 2]?.alias ?? "?"}
                    <span className="text-red-500 font-black mx-2">vs</span>
                    {tournament.participants[index * 2 + 1]?.alias ?? "?"}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="border border-white/10 p-5">
            <p className="text-sm text-white/40 mb-4">
              {tournament.bracketMode === "random"
                ? tournament.type === "king_of_the_hill" ? "El orden completo de la pista se sorteará al iniciar." : "Los enfrentamientos se sortearán aleatoriamente al iniciar."
                : tournament.type === "king_of_the_hill" ? "Usa las flechas para definir el duelo inicial y la fila de retadores." : tournament.type === "double_elimination" ? "Usa las flechas para definir el cuadro principal y el orden de la repesca." : "Usa las flechas para reordenar. Los enfrentamientos respetan el orden (1 vs 2, 3 vs 4...)."}
            </p>
            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleStart} disabled={loading} className="bg-red-600 px-6 py-3 font-battle font-black uppercase disabled:opacity-40">
                {loading ? "Iniciando..." : "Iniciar torneo"}
              </button>
              <button onClick={() => { setStep("form"); setTournament(null); }} className="border border-white/10 px-6 py-3 text-sm text-white/50 hover:text-white">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {step === "active" && tournament && (
        <div className="mt-8 space-y-8">
          <h2 className="font-battle text-xl font-black uppercase text-white/50">{tournament.name}</h2>
          {tournament.type === "king_of_the_hill" && (
            <div className="border border-red-500/30 bg-red-950/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-red-400">Dinámica de la pista</p>
              <p className="mt-2 text-sm text-white/60">El ganador de cada duelo permanece y enfrenta al siguiente retador de la fila.</p>
              {tournament.winnerId && <p className="mt-3 font-battle text-2xl uppercase text-white">Campeón: {tournament.participants.find(participant => participant.userId === tournament.winnerId)?.alias}</p>}
            </div>
          )}
          {tournament.type === "double_elimination" && (
            <div className="border border-yellow-500/30 bg-yellow-950/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-yellow-400">Doble eliminación</p>
              <p className="mt-2 text-sm text-white/60">El cuadro principal lleva al ganador invicto. Una derrota envía a repesca; la segunda elimina. Si el campeón de repesca gana la gran final, se juega una final de reinicio.</p>
              {tournament.winnerId && <p className="mt-3 font-battle text-2xl uppercase text-white">Campeón: {tournament.participants.find(participant => participant.userId === tournament.winnerId)?.alias}</p>}
            </div>
          )}
          {tournament.phases.map((phase, phaseIndex) => (
            <section key={phase.name} className="border border-white/10 p-5">
              <h2 className="font-battle text-2xl font-black uppercase">{phase.name}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {phase.battles.map((match, matchIndex) => (
                  <div key={`${phaseIndex}-${matchIndex}`}>{renderBattle(match)}</div>
                ))}
              </div>
            </section>
          ))}
          {tournament.thirdPlaceMatch?.battleId && (
            <section className="border border-white/10 p-5">
              <h2 className="font-battle text-2xl font-black uppercase">Tercer puesto</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {renderBattle(tournament.thirdPlaceMatch)}
              </div>
            </section>
          )}
          {tournament.type === "double_elimination" && tournament.losersPhases?.map((phase, phaseIndex) => (
            <section key={phase.name} className="border border-yellow-500/20 p-5">
              <h2 className="font-battle text-2xl font-black uppercase text-yellow-300">{phase.name}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {phase.battles.map((match, matchIndex) => <div key={`losers-${phaseIndex}-${matchIndex}`}>{renderBattle(match)}</div>)}
              </div>
            </section>
          ))}
          {tournament.type === "double_elimination" && tournament.grandFinal?.battleId && (
            <section className="border border-red-500/30 p-5">
              <h2 className="font-battle text-2xl font-black uppercase text-red-400">Gran final</h2>
              {renderBattle(tournament.grandFinal)}
            </section>
          )}
          {tournament.type === "double_elimination" && tournament.grandFinalReset?.battleId && (
            <section className="border border-red-500/30 p-5">
              <h2 className="font-battle text-2xl font-black uppercase text-red-400">Final de reinicio</h2>
              {renderBattle(tournament.grandFinalReset)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
