"use client";

import { useState } from "react";
import type { Battle, BattleModeConfig, Participant, ReplicaConfig, UserRole } from "@freestyle/shared";
import { useClipboard } from "@/lib/utils";
import { BattleModeSelector } from "./BattleModeSelector";
import { BattlePosterDialog } from "./BattlePosterDialog";

interface BattleLobbyProps {
  battle: Battle;
  roomId: string;
  roleLabel: string;
  isAdmin: boolean;
  canControl: boolean;
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
}

export function BattleLobby({
  battle,
  roomId,
  roleLabel,
  isAdmin,
  canControl,
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
}: BattleLobbyProps) {
  const { copied, copy } = useClipboard();
  const [configOpen, setConfigOpen] = useState(false);
  const participants: Participant[] = battle.participants;
  const missingParticipants = Math.max(0, 2 - participants.length);
  const validJudgeCount = [1, 3, 5].includes(battle.judges.length);
  const missingJudges = validJudgeCount ? 0 : 1;
  const canStart = missingParticipants === 0 && validJudgeCount;
  const missing = [
    missingParticipants ? `${missingParticipants} MC${missingParticipants > 1 ? "s" : ""}` : "",
    missingJudges ? `${missingJudges} juez` : "",
  ].filter(Boolean).join(" y ");

  const inviteLink = invitationToken && typeof window !== "undefined" ? `${window.location.origin}/unirse_batalla/${roomId}?invite=${invitationToken}` : "";
  const operationalRoles: UserRole[] = ["participant", "judge", "spectator", "host"];
  const adminCount = battle.members.filter(member => member.roles.includes("admin")).length;

  return (
    <section className="lobby-shell" aria-labelledby="lobby-title">
      <header className="lobby-pass">
        <div className="lobby-pass-copy">
          <span className="lobby-role">Rol activo: {roleLabel}</span>
          <h1 id="lobby-title">Cartel de batalla</h1>
          <p aria-live="polite">
            {canStart ? "El cartel está completo. La batalla puede comenzar." : `Esperando ${missing}.`}
          </p>
        </div>
        <button type="button" className="lobby-code" onClick={() => copy(roomId)} aria-label={`Copiar código de sala ${roomId}`}>
          <span>Código de acceso</span>
          <strong>{roomId}</strong>
          <small>{copied ? "Copiado" : "Copiar código"}</small>
        </button>
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
                  <small>{participant.userId === currentUserId ? "Tu puesto" : "En sala"}</small>
                </div>
              ) : (
                <div className="lobby-mc lobby-mc-empty" key={index}>
                  <span>MC {index + 1}</span>
                  <strong>Puesto libre</strong>
                  <small>Comparte el código</small>
                </div>
              );
            })}
            <span className="lobby-vs" aria-hidden="true">VS</span>
          </div>

          <div className="lobby-crew">
            <div>
              <span className="lobby-kicker">Mesa de jueces · {battle.judges.length}/5</span>
              <div className="lobby-tags">
                {battle.judges.length ? battle.judges.map(judge => <span key={judge.id}>{judge.alias}</span>) : <span className="lobby-tag-empty">Falta un juez</span>}
              </div>
            </div>
            <div className="lobby-audience"><strong>{battle.spectators.length}</strong><span>en el público</span></div>
          </div>

          {isAdmin && participants.length >= 2 && (
            <fieldset className="lobby-fieldset">
              <legend>Primer turno</legend>
              <div className="lobby-segments">
                <button type="button" aria-pressed={firstTurnId === "random"} onClick={() => onFirstTurnChange("random")}>Aleatorio</button>
                {participants.slice(0, 2).map(participant => (
                  <button type="button" key={participant.userId} aria-pressed={firstTurnId === participant.userId} onClick={() => onFirstTurnChange(participant.userId)}>{participant.alias}</button>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="space-y-4">
          <div className="lobby-card lobby-format">
              <div className="lobby-card-heading">
                <div><span className="lobby-kicker">Formato acordado</span><h2>{battle.mode.format === "4x4" ? "4x4" : battle.mode.format === "8x8" ? "8x8" : battle.mode.mode === "libre" ? "Freestyle libre" : "Clásico con concepto"}</h2></div>
              {isAdmin && <button type="button" className="lobby-edit" onClick={() => setConfigOpen(open => !open)} aria-expanded={configOpen} aria-controls="lobby-config">{configOpen ? "Cerrar" : "Editar formato"}</button>}
            </div>
            <dl className="lobby-rules">
              <div><dt>Extensión</dt><dd>{battle.mode.rounds} {battle.mode.rounds === 1 ? "ronda" : "rondas"}</dd></div>
              <div><dt>Turnos</dt><dd>{battle.mode.timerMode === "manual" ? `${battle.mode.entriesPerParticipant} entradas` : `${battle.mode.timePerTurn / 60} min · ${battle.mode.turnStructure === "round_trip" ? "ida y vuelta" : "solo ida"}`}</dd></div>
              <div><dt>Votación</dt><dd>{battle.mode.votingSystem === "patron" ? "Por patrón" : "Por rúbrica"}</dd></div>
              <div><dt>Conceptos</dt><dd>{battle.mode.mode === "libre" ? "Tema libre" : battle.mode.category ?? "Aleatorios"}</dd></div>
            </dl>
            <BattlePosterDialog battle={battle} variant="pre" triggerLabel="Previsualizar cartelera" triggerClassName="lobby-download" />

            {isAdmin && configOpen && (
              <div id="lobby-config" className="lobby-config">
                <BattleModeSelector value={lobbyConfig} onChange={onConfigChange} />
                <label className="lobby-toggle">
                  <span><strong>Réplica automática</strong><small>Una ronda si el resultado termina empatado</small></span>
                  <input type="checkbox" checked={replicaConfig?.enabled ?? false} onChange={onReplicaToggle} />
                </label>
                <label className="lobby-toggle">
                  <span><strong>Control en vivo</strong><small>Permite que admin/host controlen las fases manualmente. Si se desactiva, todo avanza por tiempo.</small></span>
                  <input
                    type="checkbox"
                    checked={lobbyConfig.liveControlEnabled ?? true}
                    onChange={() => onConfigChange({ ...lobbyConfig, liveControlEnabled: !(lobbyConfig.liveControlEnabled ?? true) })}
                  />
                </label>
              </div>
            )}
          </div>

          {canControl && hostCandidates.length > 0 && (
            <div className="lobby-card lobby-control">
              <div><span className="lobby-kicker">Control en vivo</span><p>Esta persona podrá avanzar las fases. Solo el admin puede iniciar.</p></div>
              <div className="lobby-tags" role="group" aria-label="Control de batalla">
                {hostCandidates.map(candidate => <button type="button" key={candidate.id} onClick={() => onHostChange(candidate.id)} aria-pressed={battle.hostId === candidate.id}>{candidate.alias}</button>)}
              </div>
            </div>
          )}

          {isAdmin && battle.members.length > 0 && (
            <div className="lobby-card lobby-role-card">
              <div className="lobby-card-heading">
                <div><span className="lobby-kicker">Gestionar</span><h2>Personas y roles</h2></div>
              </div>
              <p>Quienes entran quedan en espera hasta que un admin les asigne un rol.</p>
              <div className="lobby-role-list">
                {battle.members.map(member => {
                  const isAdminCandidate = member.roles.includes("admin");
                  const currentRole = operationalRoles.find(role => member.roles.includes(role));
                  const roleSummary = member.roles.map(role => role === "participant" ? "MC" : role === "judge" ? "Juez" : role === "spectator" ? "Público" : role === "host" ? "Host" : "Admin").join(" + ") || "En espera";
                  return (
                    <div key={member.userId} className="lobby-role-row">
                      <span>{member.alias}{member.userId === currentUserId ? " (tú)" : ""}</span>
                      <strong>{roleSummary}{member.connected ? "" : " · desconectado"}</strong>
                      <select
                        className="bg-black border border-white/10 text-xs p-2 rounded"
                        value=""
                        onChange={(e) => {
                          if (e.target.value === "waiting") {
                            operationalRoles.filter(role => member.roles.includes(role)).forEach(role => onRevokeRole(member.userId, role));
                          } else {
                            const newRole = e.target.value as UserRole;
                            if (newRole && newRole !== currentRole) onChangeRole(member.userId, newRole);
                          }
                        }}
                      >
                        <option value="" disabled>Cambiar a...</option>
                        <option value="waiting">En espera</option>
                        <option value="participant">MC</option>
                        <option value="judge">Juez</option>
                        <option value="spectator">Público</option>
                        <option value="host">Host</option>
                      </select>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {!isAdminCandidate && adminCount < 2 && <button type="button" className="lobby-edit" onClick={() => onGrantAdmin(member.userId)}>Dar admin</button>}
                        {member.userId !== currentUserId && <button type="button" className="lobby-edit" onClick={() => onTransferAdmin(member.userId)}>Transferir</button>}
                        {isAdminCandidate && member.userId !== currentUserId && adminCount > 1 && <button type="button" className="lobby-edit" onClick={() => onRevokeAdmin(member.userId)}>Quitar admin</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="lobby-card lobby-invites">
              <div className="lobby-card-heading">
                <div><span className="lobby-kicker">Compartir</span><h2>Invitar personas</h2></div>
              </div>
              <p className="text-xs text-gray-500 mb-3">Un único enlace reutilizable. Todas las personas entran en espera y reciben su rol dentro de la sala.</p>
              <div className="flex items-center gap-2">
                {!invitationToken ? (
                  <button type="button" onClick={() => onCreateInvitation(false)} className="text-xs px-3 py-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded transition disabled:opacity-40">
                    Generar invitación
                  </button>
                ) : (
                  <>
                    <span className="text-xs text-white/30 truncate font-mono flex-1">{inviteLink}</span>
                    <button type="button" onClick={() => copy(inviteLink)} className="text-xs px-2 py-1 border border-white/10 text-white/50 hover:text-white hover:border-white/30 rounded transition shrink-0">{copied ? "Copiado" : "Copiar"}</button>
                    <button type="button" onClick={() => onCreateInvitation(true)} className="text-xs px-2 py-1 border border-red-500/30 text-red-400 rounded transition disabled:opacity-40">Regenerar</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="lobby-startbar">
        <div><span className={canStart ? "is-ready" : ""}>{canStart ? "Cartel completo" : `Falta ${missing}`}</span><small>{isAdmin ? "Revisa el formato antes de abrir los micros." : "El admin iniciará cuando se complete el cartel."}</small></div>
        {isAdmin ? <button type="button" onClick={onStart} disabled={!canStart}>Iniciar batalla</button> : <span className="lobby-waiting">Esperando al admin</span>}
      </div>
    </section>
  );
}
