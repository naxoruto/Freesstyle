"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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

type CountdownNum = 3 | 2 | 1 | "go" | null;

export default function BattlePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const role = (searchParams.get("role") as UserRole) || "participant";
  const alsoAs = searchParams.get("alsoAs") as UserRole | null;
  const alias = searchParams.get("alias") || "Anónimo";
  const adminToken = searchParams.get("adminToken") || undefined;
  const requestedUserId = searchParams.get("userId");

  // FIX Bug 2: Stable userId that doesn't change between renders
  const [userId] = useState(() => requestedUserId || `${role}-${alias}-${Date.now()}`);
  const secondaryUserId = useMemo(() => (alsoAs ? `${alsoAs}-${alias}-secondary` : ""), [alsoAs, alias]);
  const scoreboardUserId = role === "admin" && alsoAs === "participant" ? secondaryUserId : userId;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [phase, setPhase] = useState<RoundPhase>("countdown");
  const [activeMcId, setActiveMcId] = useState<string>("");
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState<CountdownNum>(null);
  const [connecting, setConnecting] = useState(true);
  const [roundResult, setRoundResult] = useState<{ winnerId?: string; rubricVotes: JudgeRubricVote[]; scores: Record<string, number> } | null>(null);
  const [judgeVoted, setJudgeVoted] = useState(false);
  const [entryVoteSubmitted, setEntryVoteSubmitted] = useState(false);
  const [patronExtras, setPatronExtras] = useState({ mc1: 0, mc2: 0 });
  const [lobbyConfig, setLobbyConfig] = useState<Partial<BattleModeConfig>>({});
  const [firstTurnId, setFirstTurnId] = useState<string | "random">("random");
  const [replicaConfig, setReplicaConfig] = useState<ReplicaConfig | null>(null);
  // Rubric scoring state for judges — persist across phases (FMS-style live scoring)
  const [mc1Scores, setMc1Scores] = useState<ScoreRubric>({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });
  const [mc2Scores, setMc2Scores] = useState<ScoreRubric>({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });

  // FIX Bug 1 & 6: Use ref to track battle state in socket callbacks
  const battleRef = useRef<Battle | null>(null);
  // Track phase token from server for idempotent next_phase calls
  const phaseTokenRef = useRef<string | undefined>(undefined);

  const isJudge = role === "judge" || (role === "admin" && alsoAs === "judge");
  const isSpectator = role === "spectator";
  const isAdmin = role === "admin";
  const isLobby = battle?.status === "lobby";
  const isInProgress = battle?.status === "in_progress" || battle?.status === "replica";
  const participants = battle?.participants || [];
  const mc1 = participants[0];
  const mc2 = participants[1];
  const showScores = true;
  const isHost = Boolean(battle?.hostId && [userId, secondaryUserId].includes(battle.hostId));
  const canControl = isAdmin || isHost;
  const hostCandidates = [
    ...participants.map(({ userId: id, alias: candidateAlias }) => ({ id, alias: candidateAlias })),
    ...(battle?.judges ?? []),
    ...(battle?.spectators ?? []),
  ].filter((candidate, index, all) => all.findIndex(item => item.id === candidate.id) === index);
  const pendingEntryKey = battle?.pendingEntry ? `${battle.currentRound}:${battle.pendingEntry.mcId}:${battle.pendingEntry.entryIndex}` : "";
  const roleLabel = isAdmin ? "Admin" : isJudge ? "Juez" : isSpectator ? "Público" : "MC";

  useEffect(() => setEntryVoteSubmitted(false), [pendingEntryKey]);

  useEffect(() => {
    const s = io(WS_URL, { transports: ["websocket", "polling"], reconnectionAttempts: 10, reconnectionDelay: 1000 });

    s.on("connect", () => {
      setConnecting(false);
      s.emit("battle:join", { battleId: params.id, user: { id: userId, name: alias, alias, role }, adminToken });
      // FIX Bug 3: Admin who also participates uses a stable derived ID
      if (role === "admin" && alsoAs && alsoAs !== "admin") {
        s.emit("battle:join", { battleId: params.id, user: { id: secondaryUserId, name: alias, alias, role: alsoAs } });
      }
    });

    s.on("disconnect", () => setConnecting(false));
    s.on("connect_error", () => setConnecting(false));
    s.on("battle:error", (data: { message: string }) => showToast(data.message, "error"));

    s.on("battle:state", (data: Battle) => {
      const prevBattle = battleRef.current;
      battleRef.current = data;
      setBattle(data);
      setPhase(data.roundPhase);
      if (data.status === "lobby") {
        setLobbyConfig(data.mode);
        setReplicaConfig(data.replicaConfig ?? null);
        setFirstTurnId(data.mode.firstTurnParticipantId ?? "random");
      }

      // FIX Bug 1: Use ref instead of stale closure for comparison
      if (data.status === "in_progress" && data.roundPhase === "countdown" && prevBattle?.status !== "in_progress") {
        setCountdown(3);
      }
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
        setCountdown(3);
      }
    });

    s.on("battle:round_result", (data: { round: number; winnerId?: string; rubricVotes: JudgeRubricVote[]; scores: Record<string, number> }) => {
      setRoundResult({ winnerId: data.winnerId, rubricVotes: data.rubricVotes, scores: data.scores });
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [params.id, role, alsoAs, alias, adminToken, userId, secondaryUserId]);

  // Countdown visual effect (purely visual — server drives the transitions)
  useEffect(() => {
    if (countdown === null) return;
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
  }, [countdown]);

  // FIX Bug 4 & 5: Timer is now purely visual (server drives auto-advance)
  // The client just decrements for display purposes, no auto-emit of next_phase
  useEffect(() => {
    if (timer <= 0 || countdown !== null) return;
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
  }, [timer, countdown]);

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

  if (connecting) {
    return (
      <div className="min-h-[calc(100vh-57px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-[0.4em] uppercase text-white/20 animate-pulse">
            Conectando al servidor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      <Toaster />

      {/* HEADER — mínimo, solo conexión */}

      {/* LOBBY */}
      {isLobby && battle && (
        <BattleLobby
          battle={battle}
          roomId={params.id}
          roleLabel={roleLabel}
          isAdmin={isAdmin}
          canControl={canControl}
          currentUserId={scoreboardUserId}
          hostCandidates={hostCandidates}
          firstTurnId={firstTurnId}
          lobbyConfig={lobbyConfig}
          replicaConfig={replicaConfig}
          onConfigChange={handleConfigChange}
          onFirstTurnChange={handleFirstTurnChange}
          onHostChange={handleHostChange}
          onReplicaToggle={handleReplicaToggle}
          onStart={handleStart}
        />
      )}

      {/* IN PROGRESS */}
      {isInProgress && (
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
              <ScoreBoard participants={participants} currentTurn={activeMcId} userId={scoreboardUserId} showScores={showScores} />
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

              {/* Judge already voted */}
              {isJudge && judgeVoted && phase === "voting" && (
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
          <p className="text-xs font-semibold tracking-[0.4em] uppercase text-white/20">Batalla finalizada</p>
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
          <a
            href="/"
            className="inline-block px-8 py-3 font-battle font-black italic uppercase tracking-wider transition-all"
            style={{ background: "#e30613", color: "white" }}
          >
            Nueva Batalla
          </a>
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
