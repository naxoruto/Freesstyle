"use client";

import { useState } from "react";
import type { Battle, BattleModeConfig, Participant, ReplicaConfig, UserRole } from "@freestyle/shared";
import { isLocalParticipantId } from "@freestyle/shared";
import { useClipboard } from "@/lib/utils";
import { BattleModeSelector } from "./BattleModeSelector";
import { BattlePosterDialog } from "./BattlePosterDialog";
import { Alert, Button, Dialog, TextField } from "./ui";

interface BattleLobbyProps {
  battle: Battle;
  roomId: string;
  roleLabel: string;
  isAdmin: boolean;
  currentUserId: string;
  hostCandidates: { id: string; alias: string }[];
  firstTurnId: string | "random";
  lobbyConfig: Partial<BattleModeConfig>;
  replicaConfig: ReplicaConfig | null;
  invitationToken: string;
  onConfigChange: (config: Partial<BattleModeConfig>) => void;
  onFirstTurnChange: (id: string | "random") => void;
  onHostChange: (id: string) => void;
  onReplicaToggle: () => void;
  onStart: () => void;
  onChangeRole: (targetUserId: string, newRole: UserRole) => void;
  onRevokeRole: (targetUserId: string, role: UserRole) => void;
  onGrantAdmin: (targetUserId: string) => void;
  onTransferAdmin: (targetUserId: string) => void;
  onRevokeAdmin: (targetUserId: string) => void;
  onCreateInvitation: (regenerate: boolean) => void;
  onLocalParticipant: (slot: number, alias: string, expectedUserId: string | null) => void;
}

export function BattleLobby({
  battle,
  roomId,
  roleLabel,
  isAdmin,
  currentUserId,
  hostCandidates,
  firstTurnId,
  lobbyConfig,
  replicaConfig,
  invitationToken,
  onConfigChange,
  onFirstTurnChange,
  onHostChange,
  onReplicaToggle,
  onStart,
  onChangeRole,
  onRevokeRole,
  onGrantAdmin,
  onTransferAdmin,
  onRevokeAdmin,
  onCreateInvitation,
  onLocalParticipant,
}: BattleLobbyProps) {
  const { copied, copy } = useClipboard();
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [localSlot, setLocalSlot] = useState<number | null>(null);
  const [localAlias, setLocalAlias] = useState("");
  const [localExpectedId, setLocalExpectedId] = useState<string | null>(null);
  const participants: Participant[] = battle.participants;
  const missingParticipants = Math.max(0, 2 - participants.length);
  const exhibition = lobbyConfig.exhibition ?? false;
  const judgeCount = battle.judges.length;
  const validJudgeCount = [1, 3, 5].includes(judgeCount);
  const canStart = missingParticipants === 0 && (exhibition || validJudgeCount);
  const judgeHint = (() => {
    if (exhibition) return "";
    if (judgeCount === 0) return "1, 3 o 5 jueces";
    if (judgeCount === 2 || judgeCount === 4) return "sobra 1 o falta 1 juez";
    if (judgeCount > 5) return `sobran ${judgeCount - 5} jueces`;
    return "";
  })();
  const missing = [
    missingParticipants ? `${missingParticipants} MC${missingParticipants > 1 ? "s" : ""}` : "",
    judgeHint,
  ].filter(Boolean).join(" y ");

  const inviteLink = invitationToken && typeof window !== "undefined" ? `${window.location.origin}/unirse_batalla/${roomId}?invite=${invitationToken}` : "";
  const operationalRoles: UserRole[] = ["participant", "judge", "spectator", "host"];
  const adminCount = battle.members.filter(member => member.roles.includes("admin")).length;
  const member = battle.members.find(person => person.userId === selectedMember);
  const roleOptions: { role: UserRole | "waiting"; emoji: string; label: string }[] = [
    { role: "participant", emoji: "🎤", label: "MC" }, { role: "judge", emoji: "⚖️", label: "Juez" },
    { role: "spectator", emoji: "👏", label: "Público" }, { role: "host", emoji: "🎙️", label: "Host" },
    { role: "waiting", emoji: "⏳", label: "En espera" },
  ];
  const openLocalSlot = (index: number) => { setLocalAlias(participants[index]?.alias ?? ""); setLocalExpectedId(participants[index]?.userId ?? null); setLocalSlot(index); };

  return (
    <section className="lobby-shell" aria-labelledby="lobby-title">
      <header className="lobby-pass">
        <div className="lobby-pass-copy">
          <span className="lobby-role">Rol activo: {roleLabel}</span>
          <h1 id="lobby-title">Cartel de batalla</h1>
          <p aria-live="polite">
            {canStart ? "El cartel está completo. La batalla puede comenzar." : `Esperando ${missing}.`}
          </p>
          {isAdmin && <Button variant="ghost" size="sm" className="!text-[#4b595f] hover:!text-black" onClick={() => onCreateInvitation(!!invitationToken)}>{invitationToken ? "Renovar enlace" : "Preparar enlace"}</Button>}
        </div>
        <Button variant="secondary" className="lobby-code !flex-col !items-start" disabled={isAdmin && !inviteLink}
          onClick={() => copy(`Te invitaron a una batalla 1vs1. Tu código es ${roomId}.\n${inviteLink ? `Entra aquí: ${inviteLink}` : `Abre ${window.location.origin} e ingresa el código para unirte.`}`)} aria-label={`Copiar invitación y código de sala ${roomId}`}>
          <span>Código de acceso</span>
          <strong>{roomId}</strong>
          <small className="min-h-4" aria-live="polite">{copied ? "Invitación copiada" : isAdmin && !inviteLink ? "Preparando enlace…" : "Copiar invitación"}</small>
        </Button>
      </header>

      <div className="lobby-grid">
        <div className="lobby-card lobby-lineup">
          <div className="lobby-card-heading">
            <div><span className="lobby-kicker">Enfrentamiento</span><h2>MCs convocados</h2></div>
            <span className="lobby-count">{Math.min(participants.length, 2)} / 2</span>
          </div>

          <div className="lobby-versus">
            {[0, 1].map(index => {
              const participant = participants[index];
              return participant ? (
                <div className="lobby-mc" key={participant.userId}>
                  <span>MC {index + 1}</span>
                  <strong>{participant.alias}</strong>
                  <small>{isLocalParticipantId(participant.userId) ? "MC presencial" : participant.userId === currentUserId ? "Tu puesto" : "En sala"}</small>
                  {isAdmin && isLocalParticipantId(participant.userId) && <Button variant="ghost" size="sm" onClick={() => openLocalSlot(index)}>Editar MC</Button>}
                </div>
              ) : (
                <div className="lobby-mc lobby-mc-empty" key={index}>
                  <span>MC {index + 1}</span>
                  <strong>Puesto libre</strong>
                  <small>Comparte el código</small>
                  {isAdmin && <Button variant="secondary" size="sm" className="mt-3" disabled={index > participants.length} onClick={() => openLocalSlot(index)}>{index > participants.length ? "Completa MC 1 primero" : "Agregar MC presencial"}</Button>}
                </div>
              );
            })}
            <span className="lobby-vs" aria-hidden="true">VS</span>
          </div>

          <div className="lobby-crew">
            <div>
              <span className="lobby-kicker">{exhibition ? "Exhibición" : `Mesa de jueces · ${battle.judges.length}/5`}</span>
              <div className="lobby-tags">
                {exhibition ? <span className="lobby-tag-empty">Sin jueces ni puntaje</span> : battle.judges.length ? battle.judges.map(judge => <span key={judge.id}>{judge.alias}</span>) : <span className="lobby-tag-empty">Falta un juez</span>}
              </div>
            </div>
            <div className="lobby-audience"><strong>{battle.spectators.length}</strong><span>en el público</span></div>
          </div>

          {isAdmin && participants.length >= 2 && (
            <fieldset className="lobby-fieldset">
              <legend>Primer turno</legend>
              <div className="lobby-segments">
                <Button variant="option" size="sm" aria-pressed={firstTurnId === "random"} onClick={() => onFirstTurnChange("random")}>Aleatorio</Button>
                {participants.slice(0, 2).map(participant => (
                  <Button key={participant.userId} variant="option" size="sm" aria-pressed={firstTurnId === participant.userId} onClick={() => onFirstTurnChange(participant.userId)}>{participant.alias}</Button>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="space-y-4">
          <div className="lobby-card lobby-format">
              <div className="lobby-card-heading">
                <div><span className="lobby-kicker">Formato acordado</span><h2>{battle.mode.format === "4x4" ? "4x4" : battle.mode.format === "8x8" ? "8x8" : battle.mode.mode === "libre" ? "Freestyle libre" : "Clásico con concepto"}</h2></div>
              {isAdmin && <Button type="button" variant="ghost" size="sm" className="lobby-edit" onClick={() => setConfigOpen(true)} aria-haspopup="dialog">Editar formato</Button>}
            </div>
            <dl className="lobby-rules">
              <div><dt>Extensión</dt><dd>{battle.mode.rounds} {battle.mode.rounds === 1 ? "ronda" : "rondas"}</dd></div>
              <div><dt>Turnos</dt><dd>{battle.mode.timerMode === "manual" ? `${battle.mode.entriesPerParticipant} entradas` : `${battle.mode.timePerTurn / 60} min · ${battle.mode.turnStructure === "round_trip" ? "ida y vuelta" : "solo ida"}`}</dd></div>
              <div><dt>Votación</dt><dd>{exhibition ? "Sin jueces (exhibición)" : battle.mode.votingSystem === "patron" ? "Por patrón" : "Por rúbrica"}</dd></div>
              <div><dt>Conceptos</dt><dd>{battle.mode.mode === "libre" ? "Tema libre" : battle.mode.category ?? "Aleatorios"}</dd></div>
            </dl>

            {isAdmin && (
              <div className="lobby-modality mt-4">
                <p className="lobby-kicker">Modalidad</p>
                <div className="lobby-segments">
                  <Button variant="option" size="sm" aria-pressed={!exhibition} onClick={() => onConfigChange({ ...lobbyConfig, exhibition: false })}>Batalla con jueces</Button>
                  <Button variant="option" size="sm" aria-pressed={exhibition} onClick={() => onConfigChange({ ...lobbyConfig, exhibition: true })}>Exhibición</Button>
                </div>
              </div>
            )}

            <BattlePosterDialog battle={battle} variant="pre" triggerLabel="Previsualizar cartelera" triggerClassName="lobby-download" />

            {isAdmin && configOpen && (
              <Dialog open={configOpen} onClose={() => setConfigOpen(false)} title="Editar formato">
                <p className="mb-4 text-sm text-white/60">Los cambios se guardan al elegir cada opción.</p>
                <BattleModeSelector value={lobbyConfig} onChange={config => onConfigChange({ ...config, ...((config.timerMode ?? lobbyConfig.timerMode) === "manual" ? { liveControlEnabled: true } : {}) })} />
                <label className="lobby-toggle">
                  <span><strong>Réplica automática</strong><small>{replicaConfig?.enabled ? `Hasta ${replicaConfig.maxReplicas} réplica${replicaConfig.maxReplicas !== 1 ? "s" : ""} · ${replicaConfig.tieRange === 0 ? "empate exacto" : `diferencia ≤ ${replicaConfig.tieRange} pts`} · ${replicaConfig.mode.format}` : "Sin réplica automática"}</small></span>
                  <input type="checkbox" checked={replicaConfig?.enabled ?? false} onChange={onReplicaToggle} />
                </label>
                <label className="lobby-toggle">
                  <span><strong>Control manual</strong><small>{lobbyConfig.timerMode === "manual" ? "Obligatorio por entradas: tú o el host marcan cada entrada. No necesitas asignar un host." : "El servidor lleva los tiempos. Al activarlo, tú o el host también pueden avanzar las fases."}</small></span>
                  <input
                    type="checkbox"
                    checked={lobbyConfig.liveControlEnabled ?? true}
                    disabled={lobbyConfig.timerMode === "manual" && lobbyConfig.liveControlEnabled !== false}
                    onChange={() => onConfigChange({ ...lobbyConfig, liveControlEnabled: !(lobbyConfig.liveControlEnabled ?? true) })}
                  />
                </label>
              </Dialog>
            )}
          </div>

          {isAdmin && (
            <div className="lobby-card lobby-control">
              <div><span className="lobby-kicker">Host opcional</span><p>{lobbyConfig.timerMode === "manual" ? "Sin host, tú marcas las entradas como organizador." : "El servidor lleva el reloj automáticamente, haya host o no."} Solo el organizador inicia la batalla.</p></div>
              <div className="lobby-tags" role="group" aria-label="Host de la batalla">
                <Button variant="option" size="sm" aria-pressed={!battle.hostId} onClick={() => battle.hostId && onRevokeRole(battle.hostId, "host")}>Sin host</Button>
                {hostCandidates.map(candidate => <Button key={candidate.id} variant="option" size="sm" onClick={() => battle.hostId === candidate.id ? onRevokeRole(candidate.id, "host") : onHostChange(candidate.id)} aria-pressed={battle.hostId === candidate.id}>{candidate.alias}</Button>)}
              </div>
            </div>
          )}

          {isAdmin && battle.members.length > 0 && (
            <div className="lobby-card lobby-role-card">
              <div className="lobby-card-heading">
                <div><span className="lobby-kicker">Gestionar</span><h2>Personas y roles</h2></div>
              </div>
              <p>Quienes entran quedan en espera. Asigná un rol (MC, Juez, Público u Host); «Organizador» es un permiso aparte.</p>
              <div className="lobby-people-grid">
                {battle.members.map(person => {
                  const role = roleOptions.find(option => person.roles.includes(option.role as UserRole)) ?? roleOptions[4];
                  return <Button key={person.userId} variant="option" className="lobby-person-tile" onClick={() => setSelectedMember(person.userId)} aria-haspopup="dialog">
                    <span className="lobby-person-emoji" aria-hidden="true">{role.emoji}</span>
                    <strong>{person.alias}{person.userId === currentUserId ? " (tú)" : ""}</strong>
                    <small>{person.roles.includes("admin") ? "Organizador · " : ""}{roleOptions.filter(option => person.roles.includes(option.role as UserRole)).map(option => option.label).join(" + ") || "En espera"}</small>
                    <small>{person.connected ? "En sala" : "Desconectado"}</small>
                  </Button>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!member && isAdmin} onClose={() => setSelectedMember(null)} title={`Roles de ${member?.alias ?? ""}`}>
        {member && <>
          <p className="mb-4 text-sm text-white/60">Elige su rol. El permiso de organizador se gestiona por separado.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {roleOptions.map(option => <Button key={option.role} variant="option" className="!items-center text-center" disabled={!member.connected}
              aria-pressed={option.role === "waiting" ? !operationalRoles.some(role => member.roles.includes(role)) : member.roles.includes(option.role)}
              onClick={() => {
                if (option.role === "waiting") operationalRoles.filter(role => member.roles.includes(role)).forEach(role => onRevokeRole(member.userId, role));
                else if (!member.roles.includes(option.role)) onChangeRole(member.userId, option.role);
              }}>
              <span className="text-3xl" aria-hidden="true">{option.emoji}</span><span>{option.label}</span>
            </Button>)}
          </div>
          {!member.connected && <Alert className="mt-4">Espera a que se reconecte para cambiar sus roles.</Alert>}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            {!member.roles.includes("admin") && adminCount < 2 && <Button variant="secondary" disabled={!member.connected} onClick={() => onGrantAdmin(member.userId)}>Dar organizador</Button>}
            {member.userId !== currentUserId && <Button variant="secondary" disabled={!member.connected} onClick={() => onTransferAdmin(member.userId)}>Transferir organización</Button>}
            {member.roles.includes("admin") && member.userId !== currentUserId && adminCount > 1 && <Button variant="danger" disabled={!member.connected} onClick={() => onRevokeAdmin(member.userId)}>Quitar organizador</Button>}
          </div>
        </>}
      </Dialog>
      <Dialog open={localSlot !== null && isAdmin} onClose={() => setLocalSlot(null)} title={`MC ${(localSlot ?? 0) + 1} presencial`}>
        <form onSubmit={event => { event.preventDefault(); if (localSlot !== null && localAlias.trim()) { onLocalParticipant(localSlot, localAlias.trim(), localExpectedId); setLocalSlot(null); } }} className="space-y-4">
          <TextField label="Nombre o AKA" autoComplete="off" value={localAlias} onChange={event => setLocalAlias(event.target.value)} maxLength={40} required hint="Sin cuenta ni dispositivo. Tú controlas la batalla y los jueces puntúan normalmente." />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!localAlias.trim()}>Guardar MC</Button>
            {localSlot !== null && localExpectedId && <Button variant="danger" onClick={() => { onLocalParticipant(localSlot, "", localExpectedId); setLocalSlot(null); }}>Quitar MC presencial</Button>}
          </div>
        </form>
      </Dialog>

      <div className="lobby-startbar">
        <div><span className={canStart ? "is-ready" : ""}>{canStart ? "Cartel completo" : `Falta ${missing}`}</span><small>{isAdmin ? "Revisa el formato antes de abrir los micros." : "El admin iniciará cuando se complete el cartel."}</small></div>
        {isAdmin ? <Button type="button" size="lg" onClick={onStart} disabled={!canStart}>Iniciar batalla</Button> : <span className="lobby-waiting">Esperando al admin</span>}
      </div>
    </section>
  );
}
