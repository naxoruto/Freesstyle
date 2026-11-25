"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { WordDisplay } from "@/components/WordDisplay";
import { Timer } from "@/components/Timer";
import { ScoreBoard } from "@/components/ScoreBoard";
import { RubricPanel } from "@/components/RubricPanel";
import { BattleLobby } from "@/components/BattleLobby";
import { BattlePosterDialog } from "@/components/BattlePosterDialog";
import { showToast, Toaster } from "@/lib/utils";
import type { Battle, UserRole, RoundPhase, Word, JudgeRubricVote, ScoreRubric, BattleModeConfig, ReplicaConfig } from "@freestyle/shared";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";
const CONNECT_TIMEOUT_MS = 10_000;
const STATE_TIMEOUT_MS = 15_000;

type CountdownNum = 3 | 2 | 1 | "go" | null;
type EntryPhase = "connecting" | "joining" | "connected" | "error";

const getSessionItem = (key: string) => {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const now = () => (typeof performance === "undefined" ? 0 : performance.now());

export default function BattlePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const pendingJoin = (() => {
    try {
      const raw = getSessionItem(`battle_pending_${params.id}`);
      return raw ? JSON.parse(raw) as { alias?: string; role?: UserRole; inviteToken?: string } : null;
    } catch { return null; }
  })();
  const alias = pendingJoin?.alias || "Anónimo";
  const adminToken = getSessionItem(`battle_admin_${params.id}`) || undefined;
  const requestedRole: UserRole | undefined = adminToken ? "admin" : pendingJoin?.role;
  const inviteToken = pendingJoin?.inviteToken;
  const returnToParam = searchParams.get("returnTo");
  const tournamentIdParam = searchParams.get("tournamentId");
  const storedReturn = (() => {
    try {
      const raw = getSessionItem(`battle_return_${params.id}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const returnTo = returnToParam || storedReturn?.returnTo || undefined;
  const tournamentId = tournamentIdParam || storedReturn?.tournamentId || undefined;

  useEffect(() => {
    if (!returnTo || !tournamentId) return;
    try {
      window.sessionStorage.setItem(`battle_return_${params.id}`, JSON.stringify({ returnTo, tournamentId }));
    } catch {}
  }, [params.id, returnTo, tournamentId]);

  // FIX Bug 2: Stable userId that doesn't change between renders
  const [userId] = useState(() => getSessionItem(`battle_user_${params.id}`) || crypto.randomUUID());
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null);
  const currentUserId = authenticatedUserId ?? userId;

  useEffect(() => {
    sessionStorage.setItem(`battle_user_${params.id}`, userId);
  }, [params.id, userId]);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [phase, setPhase] = useState<RoundPhase>("countdown");
  const [activeMcId, setActiveMcId] = useState<string>("");
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState<CountdownNum>(null);
  const [entryPhase, setEntryPhase] = useState<EntryPhase>("connecting");
  const [entryError, setEntryError] = useState("");
  const [roundResult, setRoundResult] = useState<{ winnerId?: string; rubricVotes: JudgeRubricVote[]; scores: Record<string, number> } | null>(null);
  const [judgeVoted, setJudgeVoted] = useState(false);
  const [entryVoteSubmitted, setEntryVoteSubmitted] = useState(false);
  const [patronExtras, setPatronExtras] = useState({ mc1: 0, mc2: 0 });
  const [lobbyConfig, setLobbyConfig] = useState<Partial<BattleModeConfig>>({});
  const [firstTurnId, setFirstTurnId] = useState<string | "random">("random");
  const [replicaConfig, setReplicaConfig] = useState<ReplicaConfig | null>(null);
  const [invitationToken, setInvitationToken] = useState("");
  // Rubric scoring state for judges — persist across phases (FMS-style live scoring)
  const [mc1Scores, setMc1Scores] = useState<ScoreRubric>({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });
  const [mc2Scores, setMc2Scores] = useState<ScoreRubric>({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });

  // FIX Bug 1 & 6: Use ref to track battle state in socket callbacks
  const battleRef = useRef<Battle | null>(null);
  // Track phase token from server for idempotent next_phase calls
  const phaseTokenRef = useRef<string | undefined>(undefined);
  const joinSentRef = useRef(false);
  const timersRef = useRef<{ connect?: ReturnType<typeof setTimeout>; state?: ReturnType<typeof setTimeout> }>({});
  const perfRef = useRef({ mount: now(), connect: 0, join: 0, firstState: 0 });

  const currentMember = battle?.members.find(member => member.userId === currentUserId);
  const currentRoles = currentMember?.roles ?? (requestedRole ? [requestedRole] : []);
  const isJudge = currentRoles.includes("judge");
  const isAdmin = currentRoles.includes("admin");
  const isLobby = battle?.status === "lobby";
  const isInProgress = battle?.status === "in_progress" || battle?.status === "replica";
  const participants = battle?.participants || [];
  const mc1 = participants[0];
  const mc2 = participants[1];
  const isActiveParticipant = participants.some(participant => participant.userId === currentUserId);
  const canRoomVote = battle?.mode.votingSystem === "room_vote"
    && Boolean(currentMember?.connected)
    && currentRoles.length > 0
    && !isActiveParticipant;
  const showScores = true;
  const isHost = currentRoles.includes("host") || battle?.hostId === currentUserId;
  const canControl = isAdmin || isHost;
  const hostCandidates = (battle?.members ?? []).map(member => ({ id: member.userId, alias: member.alias }));
  const pendingEntryKey = battle?.pendingEntry ? `${battle.currentRound}:${battle.pendingEntry.mcId}:${battle.pendingEntry.entryIndex}` : "";
  const roleLabel = currentRoles.length === 0 ? "En espera" : currentRoles.map(role => role === "participant" ? "MC" : role === "judge" ? "Juez" : role === "spectator" ? "Público" : role === "host" ? "Host" : "Admin").join(" + ");

  useEffect(() => setEntryVoteSubmitted(false), [pendingEntryKey]);

  useEffect(() => {
    const s = io(WS_URL, { transports: ["websocket", "polling"], withCredentials: true, reconnectionAttempts: 10, reconnectionDelay: 1000 });

    const clearEntryTimers = () => {
      if (timersRef.current.connect) { clearTimeout(timersRef.current.connect); timersRef.current.connect = undefined; }
      if (timersRef.current.state) { clearTimeout(timersRef.current.state); timersRef.current.state = undefined; }
    };

    const emitJoin = () => {
      if (joinSentRef.current) return;
      joinSentRef.current = true;
      perfRef.current.join = now();
      setEntryPhase("joining");

      s.emit("battle:join", { battleId: params.id, user: { id: userId, name: alias, alias, role: requestedRole }, adminToken, inviteToken });

      timersRef.current.state = setTimeout(() => {
        setEntryError("El servidor no respondió a tiempo. Verifica tu conexión.");
        setEntryPhase("error");
      }, STATE_TIMEOUT_MS);
    };

    // Connection timeout
    timersRef.current.connect = setTimeout(() => {
      s.close();
      setEntryError("No se pudo conectar al servidor. Revisa tu conexión a internet.");
      setEntryPhase("error");
    }, CONNECT_TIMEOUT_MS);

    s.on("connect", () => {
      perfRef.current.connect = now();
      if (timersRef.current.connect) { clearTimeout(timersRef.current.connect); timersRef.current.connect = undefined; }

      const storedSessionId = localStorage.getItem(`battle_session_${params.id}`);
      if (storedSessionId) {
        joinSentRef.current = true;
        perfRef.current.join = now();
        setEntryPhase("joining");
        s.emit("battle:reconnect", { type: "battle:reconnect", battleId: params.id, sessionId: storedSessionId });
        timersRef.current.state = setTimeout(() => {
          setEntryError("El servidor no respondió a tiempo. Verifica tu conexión.");
          setEntryPhase("error");
        }, STATE_TIMEOUT_MS);
      } else {
        emitJoin();
      }
    });

    s.on("disconnect", (reason) => {
      clearEntryTimers();
      joinSentRef.current = false;
      perfRef.current.firstState = 0;
      if (reason === "io server disconnect") {
        setEntryError("La sala se desconectó. Comprueba el servicio y vuelve a entrar.");
        setEntryPhase("error");
      } else {
        setEntryError("");
        setEntryPhase("connecting");
      }
    });
    s.on("connect_error", () => {
      if (!joinSentRef.current) {
        setEntryError("Error al conectar con el servidor.");
        setEntryPhase("error");
      }
    });
    s.on("battle:error", (data: { message: string }) => {
      showToast(data.message, "error");
      if (data.message.includes("Sesión no encontrada") || data.message.includes("expirado")) {
        localStorage.removeItem(`battle_session_${params.id}`);
        joinSentRef.current = false;
        emitJoin();
      } else if (!perfRef.current.firstState) {
        clearEntryTimers();
        setEntryError(data.message);
        setEntryPhase("error");
      }
    });

    s.on("room:joined", (data: { userId: string }) => {
      setAuthenticatedUserId(data.userId);
      sessionStorage.setItem(`battle_user_${params.id}`, data.userId);
    });

    s.on("battle:state", (data: Battle) => {
      if (timersRef.current.state) { clearTimeout(timersRef.current.state); timersRef.current.state = undefined; }
      setEntryPhase("connected");
      if (!perfRef.current.firstState) {
        perfRef.current.firstState = now();
        const mountToState = (perfRef.current.firstState - perfRef.current.mount).toFixed(0);
        const joinToState = (perfRef.current.firstState - perfRef.current.join).toFixed(0);
        console.log(`⏱️ Entrada a sala ${params.id}: ${mountToState}ms total · ${joinToState}ms desde join`);
      }
      const prevBattle = battleRef.current;
      battleRef.current = data;
      setBattle(data);
      setPhase(data.roundPhase);
      phaseTokenRef.current = data.phaseToken;
      setCurrentWord(data.currentWord ?? null);
      setActiveMcId(data.currentTurn);
      setTimer(data.recovery ? data.timeRemaining : data.phaseDeadline ? Math.max(0, Math.ceil((Date.parse(data.phaseDeadline) - Date.now()) / 1000)) : data.timeRemaining);
      if (data.recovery) setCountdown(null);
      if (data.roundPhase === "round_result") {
        const saved = data.roundResults.find(result => result.round === data.currentRound && (result.replica ?? 0) === data.replicaCount);
        if (saved) setRoundResult({ winnerId: saved.winnerId, scores: saved.scores, rubricVotes: [] });
      }
      if (data.status === "lobby") {
        setLobbyConfig(data.mode);
        setReplicaConfig(data.replicaConfig ?? null);
        setFirstTurnId(data.mode.firstTurnParticipantId ?? "random");
      }

      // FIX Bug 1: Use ref instead of stale closure for comparison
      if (!data.recovery && data.status === "in_progress" && data.roundPhase === "countdown" && prevBattle?.status !== "in_progress") {
        setCountdown(3);
      }
      });

    s.on("battle:session", (data: { sessionId: string }) => {
      localStorage.setItem(`battle_session_${params.id}`, data.sessionId);
    });

    s.on("battle:invitation", (data: { token: string }) => {
      setInvitationToken(data.token);
    });

    s.on("battle:round_start", (data: { round: number; word: Word; totalRounds: number }) => {
      setCurrentWord(data.word);
      setRoundResult(null);
      setJudgeVoted(false);
      // Reset rubric scores for the new round
      setMc1Scores({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });
      setMc2Scores({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });
    });

    s.on("battle:phase", (data: { phase: RoundPhase; participantId?: string; timeRemaining?: number; phaseToken?: string }) => {
      setPhase(data.phase);
      if (data.participantId) setActiveMcId(data.participantId);
      if (data.timeRemaining !== undefined) setTimer(data.timeRemaining);
      if (data.phaseToken) phaseTokenRef.current = data.phaseToken;

      if (data.phase === "countdown") {
        setJudgeVoted(false);
        setCurrentWord(null);
        setMc1Scores({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });
        setMc2Scores({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });
      }

      // Start visual countdown for pauses and new rounds
      // FIX Bug 7: Only start if we're not already counting down
      if (data.phase === "pause" || data.phase === "countdown") {
        const remaining = data.timeRemaining ?? 4;
        setCountdown(remaining > 3 ? 3 : remaining > 2 ? 2 : remaining > 1 ? 1 : "go");
      } else {
        setCountdown(null);
      }
    });

    s.on("battle:round_result", (data: { round: number; winnerId?: string; rubricVotes: JudgeRubricVote[]; scores: Record<string, number> }) => {
      setRoundResult({ winnerId: data.winnerId, rubricVotes: data.rubricVotes, scores: data.scores });
    });

    setSocket(s);
    return () => { clearEntryTimers(); s.disconnect(); };
  }, [params.id, requestedRole, alias, adminToken, inviteToken, userId]);

  // Countdown visual effect (purely visual — server drives the transitions)
  useEffect(() => {
    if (countdown === null || battle?.recovery) return;
    if (countdown === "go") {
      // Show "¡TIEMPO!" briefly then clear
      const t = setTimeout(() => setCountdown(null), 800);
      return () => clearTimeout(t);
    }
    const timeout = setTimeout(() => {
      if (countdown === 3) setCountdown(2);
      else if (countdown === 2) setCountdown(1);
      else if (countdown === 1) setCountdown("go");
    }, 1000);
    return () => clearTimeout(timeout);
  }, [countdown, battle?.recovery]);

  // FIX Bug 4 & 5: Timer is now purely visual (server drives auto-advance)
  // The client just decrements for display purposes, no auto-emit of next_phase
  useEffect(() => {
    if (timer <= 0 || countdown !== null || battle?.recovery) return;
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer, countdown, battle?.recovery]);

  const handleConfigChange = (config: Partial<BattleModeConfig>) => {
    const merged = { ...(battle?.mode ?? {}), ...config };
    setLobbyConfig(merged);
    socket?.emit("battle:set_mode", { type: "battle:set_mode", mode: merged });
  };

  const handleFirstTurnChange = (id: string | "random") => {
    setFirstTurnId(id);
    const merged = {
      ...(battle?.mode ?? {}),
      ...lobbyConfig,
      firstTurnParticipantId: id === "random" ? undefined : id,
    };
    socket?.emit("battle:set_mode", { type: "battle:set_mode", mode: merged });
  };

  const handleStart = () => socket?.emit("battle:start", { type: "battle:start" });
  const handleHostChange = (targetUserId: string) => socket?.emit("battle:set_host", { type: "battle:set_host", targetUserId });
  const handleChangeRole = (targetUserId: string, newRole: UserRole) => socket?.emit("battle:change_role", { type: "battle:change_role", targetUserId, newRole });
  const handleRevokeRole = (targetUserId: string, role: UserRole) => socket?.emit("battle:revoke_role", { type: "battle:revoke_role", targetUserId, role });
  const handleGrantAdmin = (targetUserId: string) => socket?.emit("battle:grant_admin", { type: "battle:grant_admin", targetUserId });
  const handleTransferAdmin = (targetUserId: string) => socket?.emit("battle:transfer_admin", { type: "battle:transfer_admin", targetUserId });
  const handleRevokeAdmin = (targetUserId: string) => socket?.emit("battle:revoke_admin", { type: "battle:revoke_admin", targetUserId });
  const handleCreateInvitation = (regenerate: boolean) => socket?.emit("battle:create_invitation", { type: "battle:create_invitation", regenerate });
  const handleCompleteEntry = () => socket?.emit("battle:complete_entry", { type: "battle:complete_entry" });
  const handleEntryVote = (points: number) => {
    socket?.emit("judge:vote_entry", { type: "judge:vote_entry", battleId: params.id, points });
    setEntryVoteSubmitted(true);
  };
  const handleReplicaToggle = () => {
    if (!battle) return;
    const config: ReplicaConfig = replicaConfig ?? {
      enabled: true,
      maxReplicas: 1,
      tieRange: 0,
      mode: { ...battle.mode, rounds: 1 },
    };
    const next = { ...config, enabled: !replicaConfig?.enabled };
    setReplicaConfig(next);
    socket?.emit("battle:set_replica", { type: "battle:set_replica", config: next });
  };
  const handlePatronExtraVote = () => {
    socket?.emit("judge:vote_patron_extra", { type: "judge:vote_patron_extra", battleId: params.id, mc1Extra: patronExtras.mc1, mc2Extra: patronExtras.mc2 });
    setJudgeVoted(true);
  };
  const handleVote = () => {
    if (!battle || !mc1 || !mc2) return;
    socket?.emit("judge:vote_rubric", {
      type: "judge:vote_rubric",
      battleId: params.id,
      round: battle.currentRound,
      mc1Id: mc1.userId,
      mc2Id: mc2.userId,
      mc1Scores,
      mc2Scores,
    });
    setJudgeVoted(true);
  };
  // FIX: Admin manually advances with phaseToken for idempotency
  const handleNextRound = () => {
    socket?.emit("battle:next_phase", { type: "battle:next_phase", phaseToken: phaseTokenRef.current });
  };

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  if (entryPhase === "error") {
    return (
      <div className="min-h-[calc(100vh-57px)] flex items-center justify-center">
        <Toaster />
        <div className="text-center px-4 max-w-md animate-slide-up">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-battle text-white mb-3">No se pudo entrar a la sala</h2>
          <p className="text-gray-400 mb-6 text-sm">{entryError || "Error inesperado."}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="px-6 py-3 font-battle font-black italic uppercase tracking-wider transition-all text-sm"
              style={{ background: "#e30613", color: "white" }}
            >
              Reintentar
            </button>
            <a
              href="/"
              className="px-6 py-3 border border-white/10 font-battle font-black italic uppercase tracking-wider text-white/50 hover:text-white hover:border-white/30 transition text-sm"
            >
              Inicio
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (entryPhase === "connecting" || entryPhase === "joining") {
    const label = entryPhase === "connecting" ? "Conectando al servidor..." : "Entrando a la sala...";
    return (
      <div className="min-h-[calc(100vh-57px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-[0.4em] uppercase text-white/20 animate-pulse">
            {label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      <Toaster />

      {/* HEADER — mínimo, solo conexión */}

      {/* BACK NAVIGATION */}
      {returnTo === "tournament" && tournamentId && (
        <a
          href={`/tournament?id=${tournamentId}`}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white transition"
        >
          <span>←</span> Volver al torneo
        </a>
      )}

      {/* LOBBY */}
      {isLobby && battle && (
        <BattleLobby
          battle={battle}
          roomId={params.id}
          roleLabel={roleLabel}
          isAdmin={isAdmin}
          canControl={canControl}
          currentUserId={currentUserId}
          hostCandidates={hostCandidates}
          firstTurnId={firstTurnId}
          lobbyConfig={lobbyConfig}
          replicaConfig={replicaConfig}
          invitationToken={invitationToken}
          onConfigChange={handleConfigChange}
          onFirstTurnChange={handleFirstTurnChange}
          onHostChange={handleHostChange}
          onReplicaToggle={handleReplicaToggle}
          onStart={handleStart}
          onChangeRole={handleChangeRole}
          onRevokeRole={handleRevokeRole}
          onGrantAdmin={handleGrantAdmin}
          onTransferAdmin={handleTransferAdmin}
          onRevokeAdmin={handleRevokeAdmin}
          onCreateInvitation={handleCreateInvitation}
        />
      )}

      {/* IN PROGRESS */}
      {isInProgress && battle?.recovery && (
        <section className="mx-auto max-w-2xl space-y-4 border border-yellow-400/30 bg-yellow-400/5 p-6" aria-label="Recuperación de batalla">
          <h2 className="font-battle text-3xl font-black uppercase">Batalla recuperada · En pausa</h2>
          <p className="text-white/70">Se conservaron la fase, los votos y los resultados. El organizador debe confirmar la reanudación.</p>
          <p className="text-sm text-white/60">Ronda {battle.currentRound} · Réplica {battle.replicaCount} · Fase: {battle.roundPhase}</p>
          <ul className="space-y-1 text-sm">{battle.members.filter(member => member.roles.length > 0).map(member => <li key={member.userId}>{member.alias} · {member.connected ? "Conectado" : "Esperando reconexión"}</li>)}</ul>
          {battle.recovery.issue ? <p role="alert" className="text-yellow-300">{battle.recovery.issue}</p> : <>
            <p className="text-sm text-white/60">{battle.phaseDeadline ? `Plazo guardado: ${new Date(battle.phaseDeadline).toLocaleTimeString()}. Si ya venció, reinicia el reloj para continuar.` : "Esta fase no tiene reloj o procede de una partida sin plazo guardado."} Deben volver los MC, los jueces y los votantes del padrón.</p>
            {canControl ? <div className="flex flex-wrap gap-3">
              <button className="bg-red-600 px-5 py-3 font-bold" onClick={() => socket?.emit("battle:resume", { action: "continue" })}>Reanudar con el plazo guardado</button>
              <button className="border border-white/30 px-5 py-3 font-bold" onClick={() => socket?.emit("battle:resume", { action: "restart_clock" })}>Reiniciar reloj de esta fase</button>
            </div> : <p className="text-sm text-yellow-300">Esperando al organizador.</p>}
          </>}
        </section>
      )}
      {isInProgress && !battle?.recovery && (
        <div className="space-y-4">
          {/* COUNTDOWN OVERLAY */}
          {countdown !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
              <div className="text-center">
                {countdown === "go" ? (
                  <div
                    className="font-battle font-black italic uppercase animate-fade-in"
                    style={{
                      fontSize: "clamp(64px,14vw,120px)",
                      color: "#e30613",
                      textShadow: "0 0 40px rgba(227,6,19,0.8), 0 0 80px rgba(227,6,19,0.4)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    ¡YA!
                  </div>
                ) : (
                  <div
                    className="font-battle font-black italic animate-fade-in"
                    style={{
                      fontSize: "clamp(120px,22vw,220px)",
                      color: "white",
                      lineHeight: 0.9,
                      textShadow: "3px 0 0 rgba(227,6,19,0.3), -1px 0 0 rgba(227,6,19,0.15)",
                    }}
                  >
                    {countdown}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ROUND INFO + LIVE badge */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-white/25">
              {battle?.status === "replica" ? `Réplica ${battle.replicaCount} · ` : ""}Ronda {battle?.currentRound} / {battle?.mode.rounds}
            </p>
            {(phase === "mc1_turn" || phase === "mc2_turn") && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" style={{ background: "#e30613" }} />
                <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: "#e30613" }}>En vivo</span>
              </div>
            )}
            {phase === "voting" && (
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-yellow-400">Votando...</p>
            )}
            {phase === "pause" && (
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/30">Preparando...</p>
            )}
          </div>

          {/* Word + Timer */}
          <WordDisplay word={battle?.mode.mode === "libre" ? "Tema libre" : currentWord?.text || null} category={currentWord?.category || ""} isActive={phase === "mc1_turn" || phase === "mc2_turn"} />
          {battle && battle.mode.timerMode === "countdown" && battle.mode.timePerTurn > 0 && (phase === "mc1_turn" || phase === "mc2_turn") && (
            <Timer seconds={timer} total={battle.mode.timePerTurn} />
          )}
          {battle && battle.mode.timerMode === "manual" && (phase === "mc1_turn" || phase === "mc2_turn") && (
            <div className="mx-auto max-w-sm border border-white/10 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-white/30">Entradas restantes</p>
              <p className="font-battle text-5xl font-black text-red-500">{battle.entriesRemaining[activeMcId] ?? battle.mode.entriesPerParticipant}</p>
              {canControl && <button onClick={handleCompleteEntry} className="mt-3 w-full bg-red-600 py-3 font-battle font-black uppercase">Entrada completada</button>}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ScoreBoard participants={participants} currentTurn={activeMcId} userId={currentUserId} showScores={showScores} />
            </div>

            {/* SIDEBAR */}
            <div className="space-y-4">
              {/* JUDGE LIVE SCORING — como en FMS: puntúas mientras rapean */}
              {isJudge && battle?.mode.votingSystem === "rubrica" && !judgeVoted && (phase === "mc1_turn" || phase === "mc2_turn" || phase === "voting") && mc1 && mc2 && (
                <div className="space-y-3 animate-slide-up">
                  {/* LIVE indicator during turns */}
                  {(phase === "mc1_turn" || phase === "mc2_turn") && (
                    <div className="flex items-center gap-2 w-fit">
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#e30613" }} />
                      <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: "#e30613" }}>Puntuando en vivo</span>
                    </div>
                  )}

                  {/* MC1 rubric — visible during mc1_turn AND voting */}
                  {(phase === "mc1_turn" || phase === "voting") && (
                    <RubricPanel
                      participantName={mc1.alias}
                      onSubmit={() => {}}
                      submitted={false}
                      externalScores={mc1Scores}
                      onScoresChange={setMc1Scores}
                      hideSubmit={true}
                      compact={phase === "voting"}
                    />
                  )}

                  {/* MC2 rubric — visible during mc2_turn AND voting */}
                  {(phase === "mc2_turn" || phase === "voting") && (
                    <RubricPanel
                      participantName={mc2.alias}
                      onSubmit={() => {}}
                      submitted={false}
                      externalScores={mc2Scores}
                      onScoresChange={setMc2Scores}
                      hideSubmit={true}
                      compact={phase === "voting"}
                    />
                  )}

                  {/* Submit button — only in voting phase */}
                  {phase === "voting" && (
                    <button
                      onClick={handleVote}
                      className="w-full py-3 font-battle font-black italic uppercase tracking-wider text-sm transition-all"
                      style={{ background: "#e30613", color: "white" }}
                    >
                      Enviar Puntuaciones
                    </button>
                  )}
                </div>
              )}

              {isJudge && battle?.mode.votingSystem === "patron" && phase === "entry_voting" && battle.pendingEntry && (
                <div className="border border-white/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/30">Puntúa esta entrada</p>
                  <p className="my-3 font-battle text-xl font-black">{participants.find(participant => participant.userId === battle.pendingEntry?.mcId)?.alias}</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 1, 2, 3, 4].map(points => (
                      <button key={points} disabled={entryVoteSubmitted} onClick={() => handleEntryVote(points)} className="border border-red-500/40 py-3 font-battle text-xl disabled:opacity-30">{points}</button>
                    ))}
                  </div>
                </div>
              )}

              {isJudge && battle?.mode.votingSystem === "patron" && phase === "voting" && !judgeVoted && mc1 && mc2 && (
                <div className="border border-white/10 p-4 space-y-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/30">Puntos extra finales</p>
                  {([["mc1", mc1], ["mc2", mc2]] as const).map(([key, participant]) => (
                    <label key={key} className="flex items-center justify-between text-sm">
                      <span>{participant.alias}</span>
                      <input type="number" min={0} max={4} value={patronExtras[key]} onChange={event => setPatronExtras(current => ({ ...current, [key]: Math.max(0, Math.min(4, Number(event.target.value))) }))} className="w-16 bg-black border border-white/10 p-2 text-center" />
                    </label>
                  ))}
                  <button onClick={handlePatronExtraVote} className="w-full bg-red-600 py-3 font-battle font-black uppercase">Enviar extras</button>
                </div>
              )}

              {isJudge && battle?.mode.votingSystem === "free_vote" && phase === "voting" && !judgeVoted && mc1 && mc2 && (
                <div className="border border-white/10 p-4 space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/30">Voto libre — Elegí al ganador</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        socket?.emit("judge:vote_free", { type: "judge:vote_free", battleId: params.id, votedForId: mc1.userId });
                        setJudgeVoted(true);
                      }}
                      className="w-full p-4 border border-red-500/40 font-battle font-black uppercase text-lg hover:bg-red-500/10 transition"
                    >
                      {mc1.alias}
                    </button>
                    <button
                      onClick={() => {
                        socket?.emit("judge:vote_free", { type: "judge:vote_free", battleId: params.id, votedForId: mc2.userId });
                        setJudgeVoted(true);
                      }}
                      className="w-full p-4 border border-red-500/40 font-battle font-black uppercase text-lg hover:bg-red-500/10 transition"
                    >
                      {mc2.alias}
                    </button>
                  </div>
                </div>
              )}

              {canRoomVote && phase === "voting" && !judgeVoted && mc1 && mc2 && (
                <div className="border border-red-500/30 p-4 space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-red-400">Voto de sala</p>
                  <p className="text-xs text-white/40">Elige quién ganó. Los MC activos no participan de esta votación.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[mc1, mc2].map(participant => (
                      <button
                        key={participant.userId}
                        onClick={() => {
                          socket?.emit("room:vote", { type: "room:vote", battleId: params.id, votedForId: participant.userId });
                          setJudgeVoted(true);
                        }}
                        className="w-full p-4 border border-red-500/40 font-battle font-black uppercase text-lg hover:bg-red-500/10 transition"
                      >
                        {participant.alias}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canRoomVote && judgeVoted && phase === "voting" && (
                <div className="p-4 border border-white/10 text-center" style={{ background: "rgba(34,197,94,0.04)" }}>
                  <p className="text-xs font-semibold tracking-[0.25em] uppercase text-green-400">Voto enviado</p>
                  <p className="text-xs text-white/20 mt-1">Esperando al resto de la sala...</p>
                </div>
              )}

              {/* Judge already voted */}
              {isJudge && battle?.mode.votingSystem !== "room_vote" && judgeVoted && phase === "voting" && (
                <div className="p-4 border border-white/10 text-center" style={{ background: "rgba(34,197,94,0.04)" }}>
                  <p className="text-xs font-semibold tracking-[0.25em] uppercase text-green-400">Puntuaciones enviadas</p>
                  <p className="text-xs text-white/20 mt-1">Esperando a los demás jueces...</p>
                </div>
              )}

              {/* ROUND RESULT */}
              {phase === "round_result" && showScores && (
                <div className="border border-white/8 animate-fade-in" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-xs font-semibold tracking-[0.25em] uppercase text-white/30">
                      Ronda {battle?.currentRound} · Resultado
                    </p>
                  </div>

                  {roundResult && (
                    <div className="divide-y divide-white/5">
                      {participants.map(p => {
                        const isWinner = p.userId === roundResult.winnerId;
                        const score = roundResult.scores[p.userId] || 0;
                        return (
                          <div
                            key={p.userId}
                            className="flex items-center justify-between px-4 py-3"
                            style={{ background: isWinner ? "rgba(245,158,11,0.06)" : "transparent" }}
                          >
                            <div>
                              <p className="font-battle font-black italic uppercase text-sm" style={{ color: isWinner ? "#f59e0b" : "rgba(255,255,255,0.5)" }}>
                                {p.alias}
                              </p>
                              {isWinner && <p className="text-xs text-yellow-500/60 tracking-wider uppercase mt-0.5">Ganador</p>}
                              {!roundResult.winnerId && <p className="text-xs text-white/30 tracking-wider uppercase mt-0.5">Empate</p>}
                            </div>
                            <span className="font-battle font-black italic text-xl" style={{ color: isWinner ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>
                              {score}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {roundResult?.rubricVotes && roundResult.rubricVotes.length > 0 && (
                    <details className="border-t border-white/5">
                      <summary className="px-4 py-2 text-xs text-white/20 cursor-pointer hover:text-white/40 tracking-widest uppercase">
                        Desglose por juez
                      </summary>
                      <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
                        {roundResult.rubricVotes.map((v, i) => {
                          const mc1Total = v.mc1Scores.flow + v.mc1Scores.lirica + v.mc1Scores.ingenio + v.mc1Scores.presencia + v.mc1Scores.tecnica;
                          const mc2Total = v.mc2Scores.flow + v.mc2Scores.lirica + v.mc2Scores.ingenio + v.mc2Scores.presencia + v.mc2Scores.tecnica;
                          const mc1Name = participants.find(p => p.userId === v.mc1Id)?.alias || "MC1";
                          const mc2Name = participants.find(p => p.userId === v.mc2Id)?.alias || "MC2";
                          return (
                            <div key={i} className="px-4 py-2 text-xs">
                              <p className="text-white/30 font-semibold tracking-wider uppercase mb-1">{v.judgeName}</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="text-white/40">{mc1Name}: <span className="text-white font-mono">{mc1Total}</span></div>
                                <div className="text-white/40">{mc2Name}: <span className="text-white font-mono">{mc2Total}</span></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {canControl && battle && battle.currentRound < battle.mode.rounds && (
                    <div className="p-3 border-t border-white/5">
                      <button
                        onClick={handleNextRound}
                        className="w-full py-2.5 font-battle font-black italic uppercase tracking-wider text-sm transition-all"
                        style={{ background: "#e30613", color: "white" }}
                      >
                        Siguiente Ronda
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Battle info */}
              <div className="px-3 py-2 border border-white/5 text-xs text-white/20 space-y-1" style={{ fontFamily: "monospace" }}>
                <p>modo · {battle?.mode.mode}</p>
                <p>tiempo · {battle?.mode.timePerTurn}s por MC</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINISHED */}
      {battle?.status === "finished" && (
        <div className="text-center py-20 space-y-8 animate-fade-in">
          <p className="text-xs font-semibold tracking-[0.4em] uppercase text-white/20">{battle.mode.exhibition ? "Exhibición finalizada" : "Batalla finalizada"}</p>
          {battle.mode.exhibition ? (
            <p className="text-white/60">La exhibición terminó sin ganador oficial.</p>
          ) : (
            <div className="flex justify-center gap-16">
              {participants.map(p => (
                <div key={p.userId} className="text-center">
                  <span
                    className="font-battle font-black italic uppercase block"
                    style={{ fontSize: 48, color: "rgba(255,255,255,0.8)", lineHeight: 1 }}
                  >
                    {p.alias}
                  </span>
                  {showScores && <span
                    className="font-battle font-black italic block mt-2"
                    style={{ fontSize: 80, color: "#f59e0b", lineHeight: 1 }}
                  >
                    {p.roundsWon}
                  </span>}
                  {showScores && <span className="text-xs text-white/20 tracking-widest uppercase">rondas</span>}
                </div>
              ))}
            </div>
          )}
          {returnTo === "tournament" && tournamentId ? (
            <div className="flex justify-center gap-3">
              <a
                href={`/tournament?id=${tournamentId}`}
                className="inline-block px-8 py-3 font-battle font-black italic uppercase tracking-wider transition-all"
                style={{ background: "#e30613", color: "white" }}
              >
                Volver al torneo
              </a>
              <a
                href="/"
                className="inline-block border border-white/20 px-8 py-3 font-battle font-black italic uppercase tracking-wider text-white transition hover:border-white/50"
              >
                Nueva Batalla
              </a>
            </div>
          ) : (
            <a
              href="/"
              className="inline-block px-8 py-3 font-battle font-black italic uppercase tracking-wider transition-all"
              style={{ background: "#e30613", color: "white" }}
            >
              Nueva Batalla
            </a>
          )}
          <BattlePosterDialog
            battle={battle}
            variant="post"
            triggerLabel="Previsualizar resultado"
            triggerClassName="ml-3 border border-white/20 px-8 py-3 font-battle font-black italic uppercase tracking-wider text-white transition hover:border-white/50"
          />
        </div>
      )}
    </div>
  );
}
