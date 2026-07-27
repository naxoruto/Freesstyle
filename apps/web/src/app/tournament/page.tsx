"use client";

import { useState } from "react";
import type { Tournament } from "@freestyle/shared";

const API_URL = process.env.NEXT_PUBLIC_WS_URL || "";

export default function TournamentPage() {
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("MC Uno\nMC Dos\nMC Tres\nMC Cuatro");
  const [random, setRandom] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [adminToken, setAdminToken] = useState("");

  const createTournament = async () => {
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
        body: JSON.stringify({ name, bracketMode: random ? "random" : "manual" }),
      });
      if (!createResponse.ok) throw new Error("No se pudo crear el torneo");
      const created = await createResponse.json();
      setAdminToken(created.adminToken);
      for (const alias of participants) {
        const response = await fetch(`${API_URL}/api/tournaments/${created.tournament.id}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminToken: created.adminToken, alias }),
        });
        if (!response.ok) throw new Error("No se pudieron registrar los participantes");
      }
      const startResponse = await fetch(`${API_URL}/api/tournaments/${created.tournament.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken: created.adminToken }),
      });
      if (!startResponse.ok) throw new Error("No se pudo generar el bracket");
      setTournament(await startResponse.json());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const openBattle = async (battleId: string) => {
    if (!tournament) return;
    const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/battles/${battleId}/access?adminToken=${encodeURIComponent(adminToken)}`);
    if (!response.ok) { setError("No se pudo abrir la sala"); return; }
    const access = await response.json();
    window.location.href = `/battle/${battleId}?role=admin&alsoAs=judge&alias=Host&adminToken=${encodeURIComponent(access.adminToken)}`;
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs uppercase tracking-[0.3em] text-red-500">Formato eliminatorio</p>
      <h1 className="mt-2 font-battle text-5xl font-black uppercase italic">Torneos</h1>

      {!tournament ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 border border-white/10 p-5">
            <input value={name} onChange={event => setName(event.target.value)} placeholder="Nombre del torneo" className="w-full border border-white/10 bg-black p-3" />
            <textarea value={aliases} onChange={event => setAliases(event.target.value)} rows={10} className="w-full border border-white/10 bg-black p-3 font-mono text-sm" />
            <label className="flex items-center gap-3 text-sm text-white/50">
              <input type="checkbox" checked={random} onChange={event => setRandom(event.target.checked)} className="accent-red-600" />
              Emparejamientos aleatorios
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={createTournament} disabled={loading} className="w-full bg-red-600 py-3 font-battle font-black uppercase disabled:opacity-40">
              {loading ? "Generando..." : "Crear bracket"}
            </button>
          </div>
          <div className="border border-white/5 p-5 text-sm leading-7 text-white/40">
            <p>Participantes permitidos: 4, 8, 16 o 32.</p>
            <p>Cada enfrentamiento crea una sala de batalla normal.</p>
            <p>Los ganadores avanzan automáticamente al siguiente cruce cuando se registran.</p>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {tournament.phases.map((phase, phaseIndex) => (
            <section key={phase.name} className="border border-white/10 p-5">
              <h2 className="font-battle text-2xl font-black uppercase">{phase.name}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {phase.battles.map((match, matchIndex) => {
                  const mc1 = tournament.participants.find(participant => participant.userId === match.mc1Id);
                  const mc2 = tournament.participants.find(participant => participant.userId === match.mc2Id);
                  return (
                    <div key={`${phaseIndex}-${matchIndex}`} className="border border-white/5 p-4 text-sm">
                      <p>{mc1?.alias ?? "Por definir"}</p>
                      <p className="my-1 text-xs text-red-500">VS</p>
                      <p>{mc2?.alias ?? "Por definir"}</p>
                      {match.battleId && (
                        <button onClick={() => openBattle(match.battleId!)} className="mt-3 block text-xs uppercase tracking-wider text-red-400">Abrir sala {match.battleId}</button>
                      )}
                      {match.battleId && mc1 && mc2 && (
                        <div className="mt-2 flex gap-3 text-xs text-white/30">
                          <a href={`/battle/${match.battleId}?role=participant&alias=${encodeURIComponent(mc1.alias)}&userId=${encodeURIComponent(mc1.userId)}`}>Link {mc1.alias}</a>
                          <a href={`/battle/${match.battleId}?role=participant&alias=${encodeURIComponent(mc2.alias)}&userId=${encodeURIComponent(mc2.userId)}`}>Link {mc2.alias}</a>
                        </div>
                      )}
                      {match.battleId && !match.winnerId && mc1 && mc2 && (
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => registerWinner(match.battleId!, mc1.userId)} className="border border-white/10 px-2 py-1 text-xs">Ganó {mc1.alias}</button>
                          <button onClick={() => registerWinner(match.battleId!, mc2.userId)} className="border border-white/10 px-2 py-1 text-xs">Ganó {mc2.alias}</button>
                        </div>
                      )}
                      {match.winnerId && <p className="mt-3 text-xs uppercase text-green-400">Ganador registrado</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
