"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { WordDisplay } from "@/components/WordDisplay";
import { Timer } from "@/components/Timer";
import { ScoreBoard } from "@/components/ScoreBoard";
import { Toaster, useClipboard } from "@/lib/utils";
import type { Battle, UserRole, RoundPhase, Word, RoundVote } from "@freestyle/shared";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

type CountdownNum = 3 | 2 | 1 | "go" | null;

export default function BattlePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const role = (searchParams.get("role") as UserRole) || "participant";
  const alsoAs = searchParams.get("alsoAs") as UserRole | null;
  const alias = searchParams.get("alias") || "Anónimo";

  // FIX Bug 2: Stable userId that doesn't change between renders
  const userId = useMemo(() => `${role}-${alias}-${Date.now()}`, []);

  const { copied, copy } = useClipboard();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [phase, setPhase] = useState<RoundPhase>("countdown");
  const [activeMcId, setActiveMcId] = useState<string>("");
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState<CountdownNum>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [roundResult, setRoundResult] = useState<{ winnerId: string; votes: RoundVote[] } | null>(null);
  const [judgeVoted, setJudgeVoted] = useState(false);

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
    if (!battle) return;
    socket?.emit("judge:vote_round", { type: "judge:vote_round", battleId: params.id, round: battle.currentRound, winnerId });
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

      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-gray-800 bg-arena-800/30">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <div>
            <h2 className="text-sm text-gray-400">Sala <span className="text-red-400 font-mono text-lg tracking-widest font-bold">{params.id}</span></h2>
            <p className="text-xs text-gray-600">{participants.length} MCs · {battle?.judges.length || 0} jueces{!connected && <span className="text-red-500 ml-2">· Reconectando...</span>}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => copy(params.id)} className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition flex items-center gap-1">{copied ? "✅" : "📋"} {copied ? "Copiado" : "Copiar código"}</button>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isLobby ? "bg-yellow-500/20 text-yellow-400" : isInProgress ? "bg-green-500/20 text-green-400 animate-pulse" : "bg-gray-500/20 text-gray-400"}`}>
            {isLobby ? "SALA DE ESPERA" : isInProgress ? "🔥 EN CURSO" : "FINALIZADA"}
          </span>
        </div>
      </div>

      {/* LOBBY */}
      {isLobby && (
        <div className="text-center py-16 space-y-6 animate-fade-in">
          <div className="text-6xl">⏳</div>
          <h3 className="text-2xl font-battle text-white">Sala de Espera</h3>
          <p className="text-gray-500 max-w-md mx-auto">Comparte el código <span className="text-red-400 font-mono font-bold">{params.id}</span> para que se unan.</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="px-4 py-2 rounded-xl bg-arena-800/50 border border-gray-800"><span className="text-gray-500">🎤 MCs: </span><span className="text-white font-bold">{participants.length}</span>{participants.length < 2 && <span className="text-yellow-500 ml-1">(mín. 2)</span>}</div>
            <div className="px-4 py-2 rounded-xl bg-arena-800/50 border border-gray-800"><span className="text-gray-500">⚖️ Jueces: </span><span className="text-white font-bold">{battle?.judges.length || 0}</span></div>
          </div>
          {isAdmin && (
            <button onClick={handleStart} disabled={participants.length < 2}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-bold text-white transition">🚀 Iniciar Batalla</button>
          )}
          {!isAdmin && <p className="text-gray-600 text-sm">Esperando a que el admin inicie la batalla...</p>}
          {participants.length > 0 && <ScoreBoard participants={participants} currentTurn="" userId={userId} />}
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
              {/* JUDGE VOTING */}
              {isJudge && phase === "voting" && mc1 && mc2 && (
                <div className="p-4 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 animate-slide-up space-y-3">
                  <h3 className="font-battle text-yellow-400 text-center text-sm">⚖️ ¿Quién ganó la ronda?</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleVote(mc1.userId)} disabled={judgeVoted}
                      className="p-4 rounded-xl border-2 border-red-500/30 bg-arena-800/50 hover:border-red-500 hover:bg-red-500/10 disabled:opacity-50 transition text-center">
                      <span className="text-2xl block mb-1">👑</span>
                      <span className="font-bold text-white block">{mc1.alias}</span>
                      <span className="text-xs text-gray-500">Ganó la ronda</span>
                    </button>
                    <button onClick={() => handleVote(mc2.userId)} disabled={judgeVoted}
                      className="p-4 rounded-xl border-2 border-blue-500/30 bg-arena-800/50 hover:border-blue-500 hover:bg-blue-500/10 disabled:opacity-50 transition text-center">
                      <span className="text-2xl block mb-1">👑</span>
                      <span className="font-bold text-white block">{mc2.alias}</span>
                      <span className="text-xs text-gray-500">Ganó la ronda</span>
                    </button>
                  </div>
                  {judgeVoted && <p className="text-xs text-green-400 text-center">✅ Voto registrado</p>}
                </div>
              )}

              {/* ROUND RESULT */}
              {phase === "round_result" && (
                <div className="p-4 rounded-2xl border-2 border-green-500/30 bg-green-500/5 text-center animate-bounce-in space-y-3">
                  <h3 className="font-battle text-green-400">🏆 Ronda {battle?.currentRound}</h3>
                  <div className="flex justify-center gap-4">
                    {participants.map(p => (
                      <div key={p.userId} className="text-center">
                        <span className="font-bold text-white block">{p.alias}</span>
                        <span className="text-2xl font-battle text-yellow-400">{p.roundsWon}</span>
                        <span className="text-xs text-gray-500 block">rondas</span>
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
