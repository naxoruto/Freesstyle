"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { WordDisplay } from "@/components/WordDisplay";
import { Timer } from "@/components/Timer";
import { ScoreBoard } from "@/components/ScoreBoard";
import { RubricPanel } from "@/components/RubricPanel";
import { Toaster } from "@/lib/utils";
import type { Battle, UserRole, RoundPhase, Word, JudgeRubricVote, ScoreRubric } from "@freestyle/shared";

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
    return <div className="min-h-[calc(100vh-57px)] flex items-center justify-center"><div className="text-center"><div className="text-5xl mb-4 animate-bounce">🎤</div><p className="text-gray-400 text-lg">Conectando al servidor...</p></div></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      <Toaster />

      {/* HEADER — mínimo, solo conexión */}

      {/* LOBBY */}
      {isLobby && (
        <div className="text-center py-8 space-y-6">
          {/* Participantes */}
          {participants.length > 0 && (
            <ScoreBoard participants={participants} currentTurn="" userId={userId} />
          )}

          {/* Jueces */}
          {battle && battle.judges.length > 0 && (
            <div className="max-w-md mx-auto p-4 rounded-2xl border border-gray-800 bg-arena-800/30">
              <h3 className="font-battle text-sm text-white mb-2">⚖️ Jueces</h3>
              <div className="flex flex-wrap justify-center gap-2">
                {battle.judges.map((judge) => (
                  <span key={judge.id} className="px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                    {judge.alias}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isAdmin ? (
            <button onClick={handleStart} disabled={participants.length < 2}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-bold text-white transition">
              🚀 Iniciar Batalla
            </button>
          ) : (
            <p className="text-gray-500 text-sm">Esperando a que el admin inicie la batalla...</p>
          )}
        </div>
      )}

      {/* IN PROGRESS */}
      {isInProgress && (
        <div className="space-y-4">
          {/* COUNTDOWN OVERLAY */}
          {countdown !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="text-center animate-bounce-in">
                {countdown === "go" ? (
                  <div className="text-8xl font-battle text-red-500 animate-pulse text-glow">¡TIEMPO!</div>
                ) : (
                  <div className="text-[12rem] font-battle text-white leading-none animate-bounce">{countdown}</div>
                )}
              </div>
            </div>
          )}

          {/* ROUND INFO */}
          <div className="text-center text-sm text-gray-500">
            Ronda {battle?.currentRound} de {battle?.mode.rounds}
            {currentWord && <span className="ml-2 text-gray-600">· Categoría: {currentWord.category}</span>}
          </div>

          {/* Phase indicator */}
          <div className="text-center">
            {phase === "mc1_turn" && mc1 && (
              <p className="text-sm text-gray-400">🎤 Rapeando: <span className="text-white font-bold text-lg">{mc1.alias}</span></p>
            )}
            {phase === "pause" && (
              <p className="text-sm text-yellow-400">⏸️ Preparando siguiente MC...</p>
            )}
            {phase === "mc2_turn" && mc2 && (
              <p className="text-sm text-gray-400">🎤 Rapeando: <span className="text-white font-bold text-lg">{mc2.alias}</span></p>
            )}
            {phase === "voting" && (
              <p className="text-lg font-battle text-yellow-400">⚖️ ¡Los jueces están votando!</p>
            )}
            {phase === "round_result" && (
              <p className="text-lg font-battle text-green-400">✅ Ronda completada</p>
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
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 w-fit">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs text-red-400 font-bold uppercase tracking-wider">Puntuando en vivo</span>
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
                      className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold text-white transition flex items-center justify-center gap-2"
                    >
                      📤 Enviar Puntuaciones
                    </button>
                  )}
                </div>
              )}

              {/* Judge already voted */}
              {isJudge && judgeVoted && phase === "voting" && (
                <div className="p-4 rounded-2xl border-2 border-green-500/30 bg-green-500/5 text-center">
                  <span className="text-2xl block mb-1">✅</span>
                  <p className="text-sm text-green-400 font-bold">Puntuaciones enviadas</p>
                  <p className="text-xs text-gray-500 mt-1">Esperando a los demás jueces...</p>
                </div>
              )}

              {/* ROUND RESULT with rubric breakdown */}
              {phase === "round_result" && (
                <div className="p-4 rounded-2xl border-2 border-green-500/30 bg-green-500/5 text-center animate-bounce-in space-y-3">
                  <h3 className="font-battle text-green-400">🏆 Ronda {battle?.currentRound}</h3>

                  {roundResult && (
                    <div className="space-y-2">
                      {participants.map(p => {
                        const isWinner = p.userId === roundResult.winnerId;
                        const score = roundResult.scores[p.userId] || 0;
                        return (
                          <div key={p.userId} className={`p-3 rounded-xl ${isWinner ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-arena-900/50"}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">{p.alias}</span>
                              <span className={`text-xl font-battle ${isWinner ? "text-yellow-400" : "text-gray-400"}`}>
                                {score} pts
                              </span>
                            </div>
                            {isWinner && <span className="text-xs text-yellow-500">👑 Ganador de la ronda</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rubric detail per judge */}
                  {roundResult?.rubricVotes && roundResult.rubricVotes.length > 0 && (
                    <details className="text-left mt-3">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">📋 Ver desglose por juez</summary>
                      <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                        {roundResult.rubricVotes.map((v, i) => {
                          const mc1Total = v.mc1Scores.flow + v.mc1Scores.lirica + v.mc1Scores.ingenio + v.mc1Scores.presencia + v.mc1Scores.tecnica;
                          const mc2Total = v.mc2Scores.flow + v.mc2Scores.lirica + v.mc2Scores.ingenio + v.mc2Scores.presencia + v.mc2Scores.tecnica;
                          const mc1Name = participants.find(p => p.userId === v.mc1Id)?.alias || "MC1";
                          const mc2Name = participants.find(p => p.userId === v.mc2Id)?.alias || "MC2";
                          return (
                            <div key={i} className="p-2 rounded-lg bg-arena-900/50 text-xs">
                              <p className="text-gray-400 font-bold mb-1">⚖️ {v.judgeName}</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-gray-500">{mc1Name}: </span>
                                  <span className="text-white font-mono">{mc1Total} pts</span>
                                  <span className="text-gray-600 ml-1">(F:{v.mc1Scores.flow} L:{v.mc1Scores.lirica} I:{v.mc1Scores.ingenio} P:{v.mc1Scores.presencia} T:{v.mc1Scores.tecnica})</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">{mc2Name}: </span>
                                  <span className="text-white font-mono">{mc2Total} pts</span>
                                  <span className="text-gray-600 ml-1">(F:{v.mc2Scores.flow} L:{v.mc2Scores.lirica} I:{v.mc2Scores.ingenio} P:{v.mc2Scores.presencia} T:{v.mc2Scores.tecnica})</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  <div className="flex justify-center gap-4 mt-2">
                    {participants.map(p => (
                      <div key={p.userId} className="text-center">
                        <span className="text-xs text-gray-500 block">Rondas ganadas</span>
                        <span className="text-lg font-battle text-white">{p.roundsWon}</span>
                      </div>
                    ))}
                  </div>

                  {isAdmin && battle && battle.currentRound < battle.mode.rounds && (
                    <button onClick={handleNextRound}
                      className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white text-sm transition">
                      ▶️ Siguiente Ronda
                    </button>
                  )}
                </div>
              )}

              {/* Battle info */}
              <div className="p-3 rounded-xl bg-arena-900/50 text-xs text-gray-500 space-y-1">
                <p>Modo: <span className="text-white">{battle?.mode.mode}</span></p>
                <p>Tiempo por MC: <span className="text-white">{battle?.mode.timePerTurn}s</span></p>
                <p>Fase: <span className="text-white">{phase}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINISHED */}
      {battle?.status === "finished" && (
        <div className="text-center py-16 space-y-6 animate-bounce-in">
          <div className="text-6xl">🏆</div>
          <h3 className="text-3xl font-battle text-yellow-400">¡Batalla Finalizada!</h3>
          <div className="flex justify-center gap-8">
            {participants.map(p => (
              <div key={p.userId} className="text-center">
                <span className="font-bold text-white text-xl block">{p.alias}</span>
                <span className="text-4xl font-battle text-yellow-400 block">{p.roundsWon}</span>
                <span className="text-xs text-gray-500">rondas ganadas</span>
              </div>
            ))}
          </div>
          <a href="/" className="inline-block px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-white transition">🎤 Nueva Batalla</a>
        </div>
      )}
    </div>
  );
}
