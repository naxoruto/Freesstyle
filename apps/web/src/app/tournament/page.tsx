"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDefaultConfig, normalizeConfig, validateConfig, type BattleModeConfig, type Tournament, type TournamentType } from "@freestyle/shared";
import { BattleModeSelector } from "../../components/BattleModeSelector";
import { Alert, Button, ButtonLink, Panel, TextArea, TextField } from "../../components/ui";

const API_URL = process.env.NEXT_PUBLIC_WS_URL || "";

type Step = "form" | "setup" | "active";

export default function TournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [logo, setLogo] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [capacity, setCapacity] = useState<number>(8);
  const [random, setRandom] = useState(true);
  const [type, setType] = useState<TournamentType>("single_elimination");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [adminToken, setAdminToken] = useState("");
  const [participantAlias, setParticipantAlias] = useState("");
  const [modeConfig, setModeConfig] = useState<BattleModeConfig>(() => createDefaultConfig("clasico"));
  const [editingRules, setEditingRules] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    const token = sessionStorage.getItem(`tournament_admin_${id}`);
    if (!token) return;
    fetch(`${API_URL}/api/tournaments/${id}`)
      .then(response => { if (!response.ok) throw new Error("No se pudo recuperar el torneo"); return response.json(); })
      .then((saved: Tournament) => {
        setAdminToken(token);
        setTournament(saved);
        setHasDrawn(!!saved.drawOrder && saved.drawOrder.join(",") === saved.participants.map(participant => participant.userId).join(","));
        setModeConfig(saved.modeConfig ?? createDefaultConfig("clasico"));
        setStep(saved.status === "setup" ? "setup" : "active");
      })
      .catch(() => setError("No se pudo recuperar el torneo"));
  }, []);

  const changeRules = (partial: Partial<BattleModeConfig>) => {
    setModeConfig(normalizeConfig(partial, partial.mode ?? "clasico"));
  };

  const loadExample = () => {
    setAliases("MC Uno\nMC Dos\nMC Tres\nMC Cuatro");
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Escribe un nombre para el torneo"); return; }
    if (!validateConfig(modeConfig).valid) { setError("Revisa las reglas de las batallas antes de crear el torneo"); return; }
    const participants = aliases.split("\n").map(alias => alias.trim()).filter(Boolean);
    if (participants.length > 0 && (participants.length < 4 || (participants.length & (participants.length - 1)) !== 0)) {
      setError("La carga inicial debe tener 4, 8 o 16 participantes. También puedes dejarla vacía y agregarlos después de crear.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { name, bracketMode: random ? "random" : "manual", type, logo: logo.trim() || undefined, organizer: organizer.trim() || undefined, capacity, modeConfig };
      if (participants.length > 0) body.participants = participants;
      const createResponse = await fetch(`${API_URL}/api/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!createResponse.ok) throw new Error("No se pudo crear el torneo");
      const created = await createResponse.json();
      setAdminToken(created.adminToken);
      sessionStorage.setItem(`tournament_admin_${created.tournament.id}`, created.adminToken);
      router.replace(`/tournament?id=${created.tournament.id}`);

      setTournament(created.tournament);
      setStep("setup");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const updateSetup = async (path: string, method: "POST" | "PUT" | "DELETE", values: Record<string, unknown> = {}) => {
    if (!tournament) return false;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, adminToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar el torneo");
      setTournament(result as Tournament);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async () => {
    const alias = participantAlias.trim();
    if (!alias) { setError("Escribe el nombre del participante"); return; }
    if (await updateSetup("/participants", "POST", { alias })) setParticipantAlias("");
  };

  const handleRemoveParticipant = (participantId: string) => updateSetup(`/participants/${participantId}`, "DELETE");
  const handlePlacement = (participantId: string, destination: "titular" | "suplente") => updateSetup("/participants/move", "POST", { participantId, destination });

  const handleSaveRules = async () => {
    if (!validateConfig(modeConfig).valid) { setError("Revisa las reglas de las batallas"); return; }
    if (await updateSetup("/rules", "PUT", { modeConfig })) setEditingRules(false);
  };

  const handleStart = async () => {
    if (!tournament || !hasDrawn) return;
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

  const handleReorder = async (index: number, direction: -1 | 1) => {
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
    } else {
      const updated = await response.json() as Tournament;
      setTournament(updated);
      setHasDrawn(!!updated.drawOrder && updated.drawOrder.join(",") === updated.participants.map(participant => participant.userId).join(","));
    }
  };

  const handleDraw = async () => {
    if (!tournament || loading || tournament.participants.length !== tournament.capacity) return;
    if (await updateSetup("/participants/sort", "POST")) setHasDrawn(true);
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
          <Button onClick={() => openBattle(match.battleId!)} variant="ghost" size="sm" className="mt-3">Abrir sala {match.battleId}</Button>
        )}

        {match.battleId && !match.winnerId && p1 && p2 && (
          <div className="mt-3 flex gap-2">
            <Button onClick={() => registerWinner(match.battleId!, p1.userId)} variant="secondary" size="sm">Ganó {p1.alias}</Button>
            <Button onClick={() => registerWinner(match.battleId!, p2.userId)} variant="secondary" size="sm">Ganó {p2.alias}</Button>
          </div>
        )}
        {match.winnerId && <p className="mt-3 text-xs uppercase text-green-400">Ganador registrado</p>}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <ButtonLink href="/" variant="ghost" size="sm" className="mb-4">
        <span>←</span> Volver al inicio
      </ButtonLink>
      <p className="text-xs uppercase tracking-[0.3em] text-red-500">Formato eliminatorio</p>
      <h1 className="mt-2 font-battle text-5xl font-black uppercase italic">Torneos</h1>

      {step === "form" && (
        <div className="mt-8 space-y-6">
          <Panel className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Tipo de torneo</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button variant="option" size="sm" onClick={() => setType("single_elimination")} aria-pressed={type === "single_elimination"}>
                  <span className="block font-bold">Eliminación directa</span>
                  <span className="text-xs text-gray-500">El que pierde queda fuera</span>
                </Button>
                <Button variant="option" size="sm" onClick={() => setType("with_third_place")} aria-pressed={type === "with_third_place"}>
                  <span className="block font-bold">Con tercer puesto</span>
                  <span className="text-xs text-gray-500">Partido extra por el 3er lugar</span>
                </Button>
                <Button variant="option" size="sm" onClick={() => setType("double_elimination")} aria-pressed={type === "double_elimination"}>
                  <span className="block font-bold">Con repesca</span>
                  <span className="text-xs text-gray-500">Dos derrotas eliminan</span>
                </Button>
              </div>
            </div>

            <TextField label="Nombre del torneo" required value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Ej: Batalla del Parque" />
            <TextField label="Organizador (opcional)" value={organizer} onChange={e => setOrganizer(e.target.value)} maxLength={60} placeholder="Persona o asociación" />
            <TextField label="Logo (opcional)" type="url" value={logo} onChange={e => setLogo(e.target.value)} placeholder="https://..." />

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Capacidad del cuadro</p>
              <div className="grid grid-cols-3 gap-2">
                {[4, 8, 16].map(n => (
                  <Button key={n} variant="option" size="sm" className="!items-center !justify-center" onClick={() => setCapacity(n)} aria-pressed={capacity === n}>{n}</Button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Reglas de las batallas</p>
              <BattleModeSelector value={modeConfig} onChange={changeRules} disabled={loading} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400 uppercase tracking-widest">Participantes (opcional)</p>
                <Button type="button" variant="ghost" size="sm" onClick={loadExample}>Cargar ejemplo</Button>
              </div>
              <TextArea label="Lista de participantes" hint="Un alias por línea. También puedes agregarlos después de crear." value={aliases} onChange={e => setAliases(e.target.value)} rows={6} placeholder="MC Uno&#10;MC Dos" controlClassName="font-mono" />
            </div>

            <label className="flex items-center gap-3 text-sm text-white/50">
              <input type="checkbox" checked={random} onChange={e => setRandom(e.target.checked)} className="accent-red-600" />
              Emparejamientos aleatorios (podés reordenar después)
            </label>

            {error && <Alert variant="error">{error}</Alert>}
            <Button onClick={handleCreate} disabled={loading} fullWidth size="lg">
              {loading ? "Creando..." : "Crear torneo"}
            </Button>
          </Panel>
          <Panel className="border-white/5 text-sm leading-7 text-white/40">
            <p>Cuadros de 4, 8 o 16 participantes. La repesca soporta 4, 8 y 16.</p>
            <p>Después de crear, podrás compartir el enlace, agregar personas y confirmar titulares.</p>
            <p>Cada enfrentamiento crea una sala de batalla normal.</p>
          </Panel>
        </div>
      )}

      {step === "setup" && tournament && (
        <div className="mt-8 space-y-6">
          <Panel className="space-y-5 border-red-500/30 bg-red-950/10">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-400">{tournament.registrationClosed ? "Inscripción confirmada · paso 2 de 2" : "Inscripción · paso 1 de 2"}</p>
              <h2 className="mt-2 font-battle text-2xl font-black uppercase">{tournament.name}</h2>
              <p className="mt-2 text-sm text-white/50">Identificador del torneo: <span className="font-mono text-white">{tournament.id}</span></p>
              {!tournament.registrationClosed && <div className="mt-4">
                <TextField label="Enlace de inscripción" readOnly value={typeof window === "undefined" ? "" : `${window.location.origin}/tournament/join/${tournament.id}`} onFocus={event => event.currentTarget.select()} hint="Comparte el enlace después de revisar las reglas. La inscripción pública se cerrará al confirmar titulares." />
              </div>}
            </div>
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">Reglas de las batallas</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setModeConfig(tournament.modeConfig ?? createDefaultConfig("clasico")); setEditingRules(!editingRules); }}>
                  {editingRules ? "Cerrar edición" : "Cambiar reglas"}
                </Button>
              </div>
              <p className="mt-2 text-sm text-white/60">{tournament.modeConfig?.format ?? "1x1"} · {tournament.modeConfig?.mode ?? "clasico"} · {tournament.modeConfig?.rounds ?? 3} rondas · {tournament.modeConfig?.timePerTurn ?? 45}s por turno</p>
              {editingRules && (
                <div className="mt-4 space-y-4">
                  <BattleModeSelector value={modeConfig} onChange={changeRules} disabled={loading} />
                  <Button onClick={handleSaveRules} disabled={loading}>Guardar reglas</Button>
                </div>
              )}
            </div>
            <div className="border-t border-white/10 pt-4">
              <div className="flex gap-2">
                <TextField id="participant-alias" label="Agregar participante a mano" value={participantAlias} onChange={event => setParticipantAlias(event.target.value)} maxLength={40} placeholder="AKA o nombre" className="min-w-0 flex-1" />
                <Button type="button" onClick={handleAddParticipant} disabled={loading || !participantAlias.trim()} className="self-end">Agregar</Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold mb-2">Titulares ({tournament.participants.length}/{tournament.capacity})</h3>
                {tournament.participants.length === 0 && <p className="text-sm text-white/40">Aún no hay titulares.</p>}
                <div className="space-y-2">
                  {tournament.participants.map(participant => (
                    <div key={participant.userId} className="flex items-center gap-2 border border-white/10 p-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{participant.alias}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handlePlacement(participant.userId, "suplente")} disabled={loading}>A suplentes</Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveParticipant(participant.userId)} disabled={loading} aria-label={`Quitar a ${participant.alias}`}>Quitar</Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">Suplentes ({tournament.suplentes.length})</h3>
                {tournament.suplentes.length === 0 && <p className="text-sm text-white/40">Aún no hay suplentes.</p>}
                <div className="space-y-2">
                  {tournament.suplentes.map(participant => (
                    <div key={participant.userId} className="flex items-center gap-2 border border-white/10 p-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{participant.alias}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handlePlacement(participant.userId, "titular")} disabled={loading}>A titulares</Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveParticipant(participant.userId)} disabled={loading} aria-label={`Quitar a ${participant.alias}`}>Quitar</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {!tournament.registrationClosed ? (
              <Button type="button" onClick={async () => { if (await updateSetup("/participants/confirm", "POST")) setHasDrawn(false); }} disabled={loading || tournament.participants.length !== tournament.capacity} size="lg">Confirmar titulares</Button>
            ) : <p className="text-sm text-green-400">Titulares confirmados. Inscripción pública cerrada; puedes corregir la lista antes de iniciar.</p>}
            {tournament.auditLog.length > 0 && (
              <details className="border-t border-white/10 pt-4 text-sm">
                <summary className="cursor-pointer font-bold text-white/70">Actividad reciente</summary>
                <ol className="mt-3 space-y-2 text-white/50">
                  {[...tournament.auditLog].reverse().slice(0, 12).map((entry, index) => (
                    <li key={`${entry.at}-${index}`}><time dateTime={entry.at} className="mr-2 text-white/30">{new Date(entry.at).toLocaleString()}</time><strong className="mr-2 text-white/60">{entry.actorId}</strong>{entry.detail}</li>
                  ))}
                </ol>
              </details>
            )}
            {error && <Alert variant="error">{error}</Alert>}
          </Panel>
          {tournament.registrationClosed && <>
          <Panel>
            <h2 className="font-battle text-2xl font-black uppercase mb-4">{tournament.name}</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-4">Participantes ({tournament.participants.length})</p>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={handleDraw} disabled={loading || tournament.participants.length !== tournament.capacity}>{hasDrawn ? "Sortear de nuevo" : "Sortear"}</Button>
              <span className={`text-sm ${hasDrawn ? "text-green-400" : "text-white/40"}`} role="status">{hasDrawn ? "Sorteo realizado · revisa el orden antes de iniciar" : "El cuadro aún no se ha sorteado"}</span>
            </div>
            {hasDrawn ? (
              <div className="space-y-2">
                {tournament.participants.map((participant, index) => (
                  <div key={participant.userId} className="flex items-center gap-2 border border-white/10 p-2 text-sm text-white/60">
                    <span className="text-xs text-white/20 w-6 text-right">{index + 1}.</span>
                    <span className="flex-1">{participant.alias}</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleReorder(index, -1)}
                      disabled={loading || index === 0}
                      aria-label={`Subir a ${participant.alias}`}
                      className="w-9 px-0"
                    >
                      ↑
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleReorder(index, 1)}
                      disabled={loading || index === tournament.participants.length - 1}
                      aria-label={`Bajar a ${participant.alias}`}
                      className="w-9 px-0"
                    >
                      ↓
                    </Button>
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
          </Panel>
          {hasDrawn && tournament.bracketMode === "manual" && tournament.type === "king_of_the_hill" && (
            <Panel>
              <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-3">Orden de la pista</p>
              <div className="border border-red-500/30 p-3 text-sm text-white/70">
                <span className="font-bold text-white">Duelo inicial:</span> {tournament.participants[0]?.alias ?? "?"}
                <span className="text-red-500 font-black mx-2">vs</span>
                {tournament.participants[1]?.alias ?? "?"}
              </div>
              <p className="mt-3 text-xs text-white/40">
                Fila de retadores: {tournament.participants.slice(2).map(participant => participant.alias).join(" → ")}
              </p>
            </Panel>
          )}
          {hasDrawn && tournament.bracketMode === "manual" && tournament.type !== "king_of_the_hill" && (
            <Panel>
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
            </Panel>
          )}
          <Panel>
            <p className="text-sm text-white/40 mb-4">
              {hasDrawn ? "El orden está guardado. Puedes volver a sortear o ajustarlo antes de iniciar." : "Confirma titulares, sortea y revisa el orden. Iniciar usará el resultado guardado."}
            </p>
            {error && <Alert variant="error" className="mb-3">{error}</Alert>}
            <div className="flex gap-3">
              <Button onClick={handleStart} disabled={loading || !hasDrawn || tournament.participants.length !== tournament.capacity} size="lg">
                {loading ? "Iniciando..." : "Iniciar torneo"}
              </Button>
            </div>
          </Panel>
          </>}
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
