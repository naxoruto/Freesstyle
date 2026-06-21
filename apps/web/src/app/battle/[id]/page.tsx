"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { WordDisplay } from "@/components/WordDisplay";
import { Timer } from "@/components/Timer";
import { ScoreBoard } from "@/components/ScoreBoard";
import { RubricPanel } from "@/components/RubricPanel";
import { BattleModeSelector } from "@/components/BattleModeSelector";
import { showToast } from "@/lib/utils";
import { Toaster } from "@/lib/utils";
import type { Battle, UserRole, RoundPhase, Word, JudgeRubricVote, ScoreRubric, BattleModeConfig } from "@freestyle/shared";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

type CountdownNum = 3 | 2 | 1 | "go" | null;

export default function BattlePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const role = (searchParams.get("role") as UserRole) || "participant";
  const alsoAs = searchParams.get("alsoAs") as UserRole | null;
  const alias = searchParams.get("alias") || "Anónimo";

  // FIX Bug 2: Stable userId that doesn't change between renders
  const userId = useMemo(() => `${role}-${alias}-${Date.now()}`, []);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [phase, setPhase] = useState<RoundPhase>("countdown");
  const [activeMcId, setActiveMcId] = useState<string>("");
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState<CountdownNum>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [roundResult, setRoundResult] = useState<{ winnerId: string; rubricVotes: JudgeRubricVote[]; scores: Record<string, number> } | null>(null);
  const [judgeVoted, setJudgeVoted] = useState(false);
  const [lobbyConfig, setLobbyConfig] = useState<Partial<BattleModeConfig>>({});
  const [firstTurnId, setFirstTurnId] = useState<string | "random">("random");
  // Rubric scoring state for judges — persist across phases (FMS-style live scoring)
  const [mc1Scores, setMc1Scores] = useState<ScoreRubric>({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });
  const [mc2Scores, setMc2Scores] = useState<ScoreRubric>({ flow: 5, lirica: 5, ingenio: 5, presencia: 5, tecnica: 5 });

  // FIX Bug 1 & 6: Use ref to track battle state in socket callbacks
  const battleRef = useRef<Battle | null>(null);
  // Track phase token from server for idempotent next_phase calls
  const phaseTokenRef = useRef<string | undefined>(undefined);

  const isJudge = role === "judge" || (role === "admin" && alsoAs === "judge");
  const isAdmin = role === "admin";
  const isLobby = battle?.status === "lobby";
  const isInProgress = battle?.status === "in_progress";
  const participants = battle?.participants || [];
  const mc1 = participants[0];
  const mc2 = participants[1];

  useEffect(() => {
    const s = io(WS_URL, { transports: ["websocket", "polling"], reconnectionAttempts: 10, reconnectionDelay: 1000 });

    s.on("connect", () => {
      setConnected(true); setConnecting(false);
      s.emit("battle:join", { battleId: params.id, user: { id: userId, name: alias, alias, role } });
      // FIX Bug 3: Admin who also participates uses a stable derived ID
      if (role === "admin" && alsoAs && alsoAs !== "admin") {
        const secondaryId = `${alsoAs}-${alias}-secondary`;
        s.emit("battle:join", { battleId: params.id, user: { id: secondaryId, name: alias, alias, role: alsoAs } });
      }
    });

    s.on("disconnect", () => { setConnected(false); setConnecting(false); });
    s.on("connect_error", () => setConnecting(false));

    s.on("battle:state", (data: Battle) => {
      const prevBattle = battleRef.current;
      battleRef.current = data;
      setBattle(data);
      setPhase(data.roundPhase);
      if (data.status === "lobby") setLobbyConfig(data.mode);

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

      // Start visual countdown for pauses and new rounds
      // FIX Bug 7: Only start if we're not already counting down
      if (data.phase === "pause" || data.phase === "countdown") {
        setCountdown(3);
      }
    });

    s.on("battle:round_result", (data: { round: number; winnerId: string; rubricVotes: JudgeRubricVote[]; scores: Record<string, number> }) => {
      setRoundResult({ winnerId: data.winnerId, rubricVotes: data.rubricVotes, scores: data.scores });
    });

    s.on("battle:error", (data: { message: string }) => {
      showToast(data.message, "error");
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [params.id]);

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
  const handleVote = (winnerId: string) => {
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
      {isLobby && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          {/* Columna izquierda: participantes y jueces */}
          <div className="space-y-4">
            {participants.length > 0 && (
              <ScoreBoard participants={participants} currentTurn="" userId={userId} />
            )}
            {battle && battle.judges.length > 0 && (
              <div className="border border-white/5 px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="text-xs font-semibold tracking-[0.25em] uppercase text-white/25 mb-3">Jueces</p>
                <div className="flex flex-wrap gap-2">
                  {battle.judges.map((judge) => (
                    <span key={judge.id} className="px-3 py-1 border border-white/10 text-xs text-white/50 font-medium">
                      {judge.alias}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quién parte (solo cuando hay 2+ participantes) */}
            {isAdmin && participants.length >= 2 && (
              <div className="p-4 rounded-2xl border border-gray-800 bg-arena-800/30">
                <h3 className="font-battle text-sm text-white mb-3">🎯 ¿Quién parte primero?</h3>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleFirstTurnChange("random")}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition text-left ${
                      firstTurnId === "random"
                        ? "border-red-500 bg-red-500/10 text-white"
                        : "border-gray-800 hover:border-gray-600 text-gray-400"
                    }`}
                  >
                    🎲 Aleatorio
                  </button>
                  {participants.map((p) => (
                    <button
                      key={p.userId}
                      onClick={() => handleFirstTurnChange(p.userId)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition text-left ${
                        firstTurnId === p.userId
                          ? "border-red-500 bg-red-500/10 text-white"
                          : "border-gray-800 hover:border-gray-600 text-gray-400"
                      }`}
                    >
                      🎤 {p.alias}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isAdmin ? (
              <button
                onClick={handleStart}
                disabled={participants.length < 2}
                className="w-full py-3.5 font-battle font-black italic uppercase tracking-wider transition-all"
                style={{
                  background: participants.length < 2 ? "rgba(255,255,255,0.05)" : "#e30613",
                  color: participants.length < 2 ? "rgba(255,255,255,0.2)" : "white",
                  cursor: participants.length < 2 ? "default" : "pointer",
                }}
              >
                Iniciar Batalla
              </button>
            ) : (
              <p className="text-center text-xs font-semibold tracking-[0.25em] uppercase text-white/20">
                Esperando al admin...
              </p>
            )}
          </div>

          {/* Columna derecha: config de modo (solo admin) */}
          {isAdmin && (
            <div className="p-5 border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-xs font-semibold tracking-[0.25em] uppercase text-white/25 mb-4">Configuración</p>
              <BattleModeSelector
                value={lobbyConfig}
                onChange={handleConfigChange}
              />
            </div>
          )}
          {!isAdmin && (
            <div className="p-5 border border-white/5 text-sm text-white/30 space-y-1.5" style={{ background: "rgba(255,255,255,0.02)", fontFamily: "monospace", fontSize: 12 }}>
              <p>modo · {battle?.mode.mode}</p>
              <p>rondas · {battle?.mode.rounds}</p>
              <p>tiempo · {battle?.mode.timePerTurn}s por MC</p>
              {battle?.mode.category && <p>categoría · {battle.mode.category}</p>}
            </div>
          )}
        </div>
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
              Ronda {battle?.currentRound} / {battle?.mode.rounds}
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
          <WordDisplay word={currentWord?.text || null} category={currentWord?.category || ""} isActive={phase === "mc1_turn" || phase === "mc2_turn"} />
          {battle && battle.mode.timePerTurn > 0 && (phase === "mc1_turn" || phase === "mc2_turn") && (
            <Timer seconds={timer} total={battle.mode.timePerTurn} isMyTurn={false} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ScoreBoard participants={participants} currentTurn={activeMcId} userId={userId} />
            </div>

            {/* SIDEBAR */}
            <div className="space-y-4">
              {/* JUDGE LIVE SCORING — como en FMS: puntúas mientras rapean */}
              {isJudge && !judgeVoted && (phase === "mc1_turn" || phase === "mc2_turn" || phase === "voting") && mc1 && mc2 && (
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
                      onClick={() => handleVote(mc2.userId)}
                      className="w-full py-3 font-battle font-black italic uppercase tracking-wider text-sm transition-all"
                      style={{ background: "#e30613", color: "white" }}
                    >
                      Enviar Puntuaciones
                    </button>
                  )}
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
              {phase === "round_result" && (
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

                  {isAdmin && battle && battle.currentRound < battle.mode.rounds && (
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
                <span
                  className="font-battle font-black italic block mt-2"
                  style={{ fontSize: 80, color: "#f59e0b", lineHeight: 1 }}
                >
                  {p.roundsWon}
                </span>
                <span className="text-xs text-white/20 tracking-widest uppercase">rondas</span>
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
        </div>
      )}
    </div>
  );
}
