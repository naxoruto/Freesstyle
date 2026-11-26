"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { BattleModeConfig } from "@freestyle/shared";
import { Alert, Button, ButtonLink, Panel, TextField } from "@/components/ui";

const API_URL = process.env.NEXT_PUBLIC_WS_URL || "";

interface Registration {
  id: string;
  name: string;
  organizer?: string;
  capacity: number;
  alias?: string;
  status: "titular" | "suplente" | "sin_inscripcion";
  registrationClosed: boolean;
  tournamentStatus: string;
  modeConfig: BattleModeConfig;
  rulesUpdatedAt?: string;
}

export default function TournamentJoinPage() {
  const { id } = useParams<{ id: string }>();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => {
      const participantId = sessionStorage.getItem(`tournament_participant_${id}`);
      const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
      fetch(`${API_URL}/api/tournaments/${id}/registration${query}`)
        .then(async response => { if (!response.ok) throw new Error("Torneo no encontrado"); return response.json(); })
        .then((data: Registration) => { setRegistration(data); setError(""); setLoading(false); })
        .catch((caught: Error) => { setError(caught.message); setLoading(false); });
    };
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(interval);
  }, [id]);

  const join = async () => {
    if (!alias.trim()) return;
    setLoading(true);
    setError("");
    try {
      const attemptKey = `tournament_join_attempt_${id}`;
      const registrationId = sessionStorage.getItem(`${attemptKey}_alias`) === alias.trim()
        ? sessionStorage.getItem(attemptKey) ?? crypto.randomUUID()
        : crypto.randomUUID();
      sessionStorage.setItem(attemptKey, registrationId);
      sessionStorage.setItem(`${attemptKey}_alias`, alias.trim());
      const response = await fetch(`${API_URL}/api/tournaments/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: alias.trim(), registrationId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo inscribir");
      sessionStorage.setItem(`tournament_participant_${id}`, result.participantId);
      setRegistration(result.registration);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <ButtonLink href="/" variant="ghost" size="sm">← Inicio</ButtonLink>
      <p className="mt-8 text-xs uppercase tracking-[0.3em] text-red-500">Inscripción al torneo</p>
      {loading && !registration && <p className="mt-6 text-white/60">Cargando torneo...</p>}
      {registration && (
        <div className="mt-5 space-y-6">
          <div>
            <h1 className="font-battle text-4xl font-black uppercase italic">{registration.name}</h1>
            {registration.organizer && <p className="mt-2 text-white/60">Organiza: {registration.organizer}</p>}
          </div>
          <Panel as="section">
            <h2 className="font-bold">Reglas de las batallas</h2>
            <ul className="mt-3 space-y-1 text-sm text-white/70">
              <li>Formato: {registration.modeConfig.format}</li>
              <li>Modalidad: {registration.modeConfig.mode}{registration.modeConfig.category ? ` · categoría ${registration.modeConfig.category}` : ""}</li>
              <li>Rondas: {registration.modeConfig.rounds}</li>
              <li>{registration.modeConfig.timerMode === "countdown" ? `${registration.modeConfig.timePerTurn}s por turno` : `${registration.modeConfig.entriesPerParticipant} entradas por participante, control manual`}</li>
              <li>Orden de turnos: {registration.modeConfig.turnStructure === "round_trip" ? "ida y vuelta" : "un turno por participante"}</li>
              <li>Votación: {{ rubrica: "rúbrica", patron: "patrón", free_vote: "voto libre", room_vote: "voto de sala" }[registration.modeConfig.votingSystem]}</li>
              <li>Dificultad: {registration.modeConfig.difficulty}</li>
              <li>Control de la batalla: {registration.modeConfig.liveControlEnabled ? "en vivo" : "sin control en vivo"}</li>
              {registration.modeConfig.exhibition && <li>Batalla de exhibición, sin ganador</li>}
              <li>Puntajes para espectadores: {registration.modeConfig.showScoresToSpectators ? "visibles" : "ocultos"}</li>
            </ul>
            {registration.rulesUpdatedAt && <p className="mt-2 text-xs text-amber-300">Reglas actualizadas antes del inicio</p>}
          </Panel>
          {registration.status !== "sin_inscripcion" ? (
            <Panel as="section" className="border-red-500/40 bg-red-950/10">
              <h2 className="font-bold">Inscripción de {registration.alias}</h2>
              <p className="mt-2 text-sm text-white/70">Estado: {registration.status === "titular" ? "titular" : "suplente"}{registration.registrationClosed ? " · lista confirmada" : " · provisional"}</p>
              <p className="mt-2 text-xs text-white/50">El organizador puede corregir la lista antes de iniciar el torneo.</p>
            </Panel>
          ) : registration.registrationClosed || registration.tournamentStatus !== "setup" ? (
            <Alert variant="info">La inscripción ya está cerrada.</Alert>
          ) : (
            <Panel as="section">
              <TextField id="tournament-alias" label="Tu nombre o AKA" value={alias} onChange={event => setAlias(event.target.value)} maxLength={40} />
              <Button onClick={join} disabled={loading || !alias.trim()} fullWidth className="mt-4">Inscribirme</Button>
            </Panel>
          )}
        </div>
      )}
      {error && <Alert variant="error" className="mt-5">{error}</Alert>}
    </main>
  );
}
