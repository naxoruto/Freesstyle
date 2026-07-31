"use client";

import { useState } from "react";

type DemoPhase = "lobby" | "live" | "finished";

const competitors = [
  { alias: "Tecito", side: "red", country: "AR", tag: "Bot · perfil técnico" },
  { alias: "SKL Press", side: "blue", country: "CL", tag: "Bot · presión y respuesta" },
] as const;

const concepts = ["Presión", "Barrio", "Futuro", "Respeto"];

export default function OneVsOneDemo() {
  const [phase, setPhase] = useState<DemoPhase>("lobby");
  const [round, setRound] = useState(1);
  const [activeCompetitor, setActiveCompetitor] = useState(0);
  const [scores, setScores] = useState([0, 0]);
  const [conceptIndex, setConceptIndex] = useState(0);

  const active = competitors[activeCompetitor];

  const startBattle = () => {
    setPhase("live");
    setActiveCompetitor(0);
  };

  const advanceTurn = () => {
    if (activeCompetitor === 0) {
      setActiveCompetitor(1);
      return;
    }

    if (round === 3) {
      setPhase("finished");
      return;
    }

    setRound(current => current + 1);
    setConceptIndex(current => (current + 1) % concepts.length);
    setActiveCompetitor(0);
  };

  const awardRound = (winnerIndex: number) => {
    setScores(current => current.map((score, index) => score + (index === winnerIndex ? 1 : 0)));
  };

  const resetDemo = () => {
    setPhase("lobby");
    setRound(1);
    setActiveCompetitor(0);
    setScores([0, 0]);
    setConceptIndex(0);
  };

  return (
    <div className="demo-shell">
      <div className="demo-grain" aria-hidden="true" />
      <header className="demo-header">
        <div>
          <p className="demo-eyebrow"><span /> Sala de prueba · 1vs1</p>
          <h1>Arma la batalla.</h1>
          <p className="demo-lede">Un vistazo rápido al flujo que verá el host antes de abrir los micros.</p>
        </div>
        <div className="demo-host-badge">
          <span className="demo-status-dot" />
          <div><small>Control de sala</small><strong>Tú · Host</strong></div>
        </div>
      </header>

      <main className="demo-main">
        <section className="demo-stage" aria-label="Enfrentamiento 1vs1">
          <div className="demo-stage-topline">
            <span className="demo-mono">FREESTYLE ARENA / DEMO-01</span>
            <span className={`demo-phase demo-phase--${phase}`}>
              <i /> {phase === "lobby" ? "Sala abierta" : phase === "live" ? "En vivo" : "Batalla cerrada"}
            </span>
          </div>

          <div className="demo-matchup">
            {competitors.map((competitor, index) => {
              const isActive = phase === "live" && activeCompetitor === index;
              return (
                <article className={`demo-competitor demo-competitor--${competitor.side}${isActive ? " is-active" : ""}`} key={competitor.alias}>
                  <div className="demo-competitor-mark">0{index + 1}</div>
                  <div className="demo-competitor-copy">
                    <span className="demo-label">Competidor {index + 1} · {competitor.country}</span>
                    <h2>{competitor.alias}</h2>
                    <p>{competitor.tag}</p>
                  </div>
                  <div className="demo-score" aria-label={`Puntaje de ${competitor.alias}`}>{scores[index]}</div>
                  {isActive && <span className="demo-now">Rapeando ahora</span>}
                  {phase === "lobby" && <span className="demo-ready">Listo</span>}
                </article>
              );
            })}
            <div className="demo-versus" aria-hidden="true"><span>VS</span><i /></div>
          </div>

          <div className="demo-middle-info">
            <div><span className="demo-label">Ronda</span><strong>{round} <small>/ 3</small></strong></div>
            <div className="demo-concept"><span className="demo-label">Concepto</span><strong>{phase === "lobby" ? "Por sortear" : concepts[conceptIndex]}</strong></div>
            <div className="demo-turn"><span className="demo-label">Turno</span><strong>{phase === "lobby" ? "Preparados" : phase === "finished" ? "Final" : active.alias}</strong></div>
          </div>
        </section>

        <aside className="demo-control-panel" aria-label="Controles del host">
          <div className="demo-panel-heading">
            <span className="demo-label">Panel del host</span>
            <span className="demo-mono">LOCAL DEMO</span>
          </div>

          {phase === "lobby" && (
            <div className="demo-control-content">
              <div className="demo-control-number">01</div>
              <h2>El cartel está completo.</h2>
              <p>Tecito y SKL Press están listos para entrar. Tú controlas el arranque y el cambio de turnos.</p>
              <button className="demo-primary-button" type="button" onClick={startBattle}>Abrir batalla <span>↗</span></button>
            </div>
          )}

          {phase === "live" && (
            <div className="demo-control-content">
              <div className="demo-control-number">0{round}</div>
              <h2>{active.alias} tiene el micro.</h2>
              <p>Cuando termine su entrada, avanza el turno. Al cerrar la ronda puedes asignar el punto.</p>
              <div className="demo-control-actions">
                <button className="demo-primary-button" type="button" onClick={advanceTurn}>Terminar entrada <span>→</span></button>
                <div className="demo-score-actions">
                  <button type="button" onClick={() => awardRound(0)} aria-label="Dar punto a Tecito">+ Tecito</button>
                  <button type="button" onClick={() => awardRound(1)} aria-label="Dar punto a SKL Press">+ SKL</button>
                </div>
              </div>
            </div>
          )}

          {phase === "finished" && (
            <div className="demo-control-content">
              <div className="demo-control-number">FIN</div>
              <h2>Batalla cerrada.</h2>
              <p>El marcador queda visible para todos. Puedes volver a preparar la sala y mostrar otro enfrentamiento.</p>
              <button className="demo-primary-button" type="button" onClick={resetDemo}>Reiniciar demo <span>↻</span></button>
            </div>
          )}

          <div className="demo-panel-footer"><span>Host activo</span><span>2 bots conectados</span></div>
        </aside>
      </main>
    </div>
  );
}
