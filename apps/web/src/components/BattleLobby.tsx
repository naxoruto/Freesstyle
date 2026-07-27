"use client";

import { useState } from "react";
import type { Battle, BattleModeConfig, Participant, ReplicaConfig } from "@freestyle/shared";
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
  onConfigChange: (config: Partial<BattleModeConfig>) => void;
  onFirstTurnChange: (id: string | "random") => void;
  onHostChange: (id: string) => void;
  onReplicaToggle: () => void;
  onStart: () => void;
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
  onConfigChange,
  onFirstTurnChange,
  onHostChange,
  onReplicaToggle,
  onStart,
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

  return (
    <section className="lobby-shell" aria-labelledby="lobby-title">
      <header className="lobby-pass">
        <div className="lobby-pass-copy">
          <div className="flex flex-wrap items-center gap-3">
            <span className="lobby-live"><span aria-hidden="true" /> Sala abierta</span>
            <span className="lobby-role">Estás como {roleLabel}</span>
          </div>
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
              <div><span className="lobby-kicker">Formato acordado</span><h2>{battle.mode.mode === "libre" ? "Freestyle libre" : "Clásico con concepto"}</h2></div>
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
        </div>
      </div>

      <div className="lobby-startbar">
        <div><span className={canStart ? "is-ready" : ""}>{canStart ? "Cartel completo" : `Falta ${missing}`}</span><small>{isAdmin ? "Revisa el formato antes de abrir los micros." : "El admin iniciará cuando se complete el cartel."}</small></div>
        {isAdmin ? <button type="button" onClick={onStart} disabled={!canStart}>Iniciar batalla</button> : <span className="lobby-waiting">Esperando al admin</span>}
      </div>
    </section>
  );
}
