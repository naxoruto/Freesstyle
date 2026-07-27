"use client";

import type { Participant } from "@freestyle/shared";

interface ScoreBoardProps {
  participants: Participant[];
  currentTurn: string;
  userId: string;
  showScores?: boolean;
}

export function ScoreBoard({ participants, currentTurn, userId, showScores = true }: ScoreBoardProps) {
  if (participants.length === 0) {
    return (
      <div className="p-8 border border-white/5 text-center">
        <p className="text-sm text-white/20 tracking-widest uppercase">Esperando participantes...</p>
      </div>
    );
  }

  // VS layout for 2 participants
  if (participants.length === 2) {
    const [mc1, mc2] = participants;
    const mc1Active = mc1.userId === currentTurn;
    const mc2Active = mc2.userId === currentTurn;

    return (
      <div className="grid border border-white/5" style={{ gridTemplateColumns: "1fr 64px 1fr" }}>
        {/* MC1 */}
        <div
          className="p-5 transition-all"
          style={{
            background: mc1Active ? "rgba(227,6,19,0.08)" : "transparent",
            borderBottom: mc1Active ? "2px solid #e30613" : "2px solid transparent",
            opacity: mc2Active ? 0.35 : 1,
          }}
        >
          <div
            className="font-battle font-black italic uppercase leading-none"
            style={{ fontSize: 36, color: mc1Active ? "white" : "rgba(255,255,255,0.7)" }}
          >
            {mc1.alias}
            {mc1.userId === userId && (
              <span className="ml-2 text-sm font-sans font-normal not-italic normal-case text-white/30">tú</span>
            )}
          </div>
          {mc1Active && (
            <p className="mt-2 text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: "#e30613" }}>
              ● Rapeando ahora
            </p>
          )}
          {showScores && <div
            className="mt-3 font-battle font-black italic"
            style={{ fontSize: 40, color: "#e30613", lineHeight: 1 }}
          >
            {mc1.roundsWon}
          </div>}
          {showScores && <p className="text-xs text-white/20 tracking-widest uppercase">rondas</p>}
        </div>

        {/* VS */}
        <div
          className="flex items-center justify-center border-l border-r border-white/5"
          style={{ background: "#050509" }}
        >
          <span
            className="font-battle font-black italic"
            style={{ fontSize: 18, color: "rgba(255,255,255,0.1)", letterSpacing: "0.1em" }}
          >
            VS
          </span>
        </div>

        {/* MC2 */}
        <div
          className="p-5 text-right transition-all"
          style={{
            background: mc2Active ? "rgba(227,6,19,0.08)" : "transparent",
            borderBottom: mc2Active ? "2px solid #e30613" : "2px solid transparent",
            opacity: mc1Active ? 0.35 : 1,
          }}
        >
          <div
            className="font-battle font-black italic uppercase leading-none"
            style={{ fontSize: 36, color: mc2Active ? "white" : "rgba(255,255,255,0.7)" }}
          >
            {mc2.alias}
            {mc2.userId === userId && (
              <span className="ml-2 text-sm font-sans font-normal not-italic normal-case text-white/30">tú</span>
            )}
          </div>
          {mc2Active && (
            <p className="mt-2 text-xs font-semibold tracking-[0.25em] uppercase" style={{ color: "#e30613" }}>
              Rapeando ahora ●
            </p>
          )}
          {showScores && <div
            className="mt-3 font-battle font-black italic"
            style={{ fontSize: 40, color: "#e30613", lineHeight: 1 }}
          >
            {mc2.roundsWon}
          </div>}
          {showScores && <p className="text-xs text-white/20 tracking-widest uppercase">rondas</p>}
        </div>
      </div>
    );
  }

  // Fallback: lista para >2 participantes
  return (
    <div className="border border-white/5">
      <div className="px-5 py-3 border-b border-white/5">
        <h3 className="font-battle font-black italic text-white uppercase tracking-wider text-sm">Participantes</h3>
      </div>
      <div className="divide-y divide-white/5">
        {participants.map((p) => {
          const isActive = p.userId === currentTurn;
          const isMe = p.userId === userId;
          return (
            <div
              key={p.userId}
              className="flex items-center justify-between px-5 py-3 transition-all"
              style={{
                background: isActive ? "rgba(227,6,19,0.07)" : "transparent",
                borderLeft: isActive ? "2px solid #e30613" : "2px solid transparent",
              }}
            >
              <div>
                <p className="font-semibold text-white">
                  {p.alias} {isMe && <span className="text-xs text-white/30">(tú)</span>}
                </p>
                {showScores && <p className="text-xs text-white/30 mt-0.5">{p.roundsWon} rondas ganadas</p>}
              </div>
              {isActive && (
                <span className="text-xs font-bold tracking-widest uppercase animate-pulse" style={{ color: "#e30613" }}>
                  RAPEANDO
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
