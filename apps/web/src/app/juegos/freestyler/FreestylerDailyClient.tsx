"use client";

import { useEffect, useState } from "react";
import type { FreestylerDailyGuess, FreestylerDailyState } from "@freestyle/shared";

interface CatalogOption {
  id: string;
  alias: string;
  realName: string | null;
  eligibleForDaily: boolean;
  country: { code: string; name: string; flagEmoji: string | null };
}

const SESSION_KEY = "freestyle-arena:daily-session";

function getSessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const sessionId = window.crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function directionLabel(direction?: string) {
  if (direction === "higher") return "↑ más";
  if (direction === "lower") return "↓ menos";
  return "";
}

function shareResult(state: FreestylerDailyState) {
  const rows = state.guesses.map((guess) => Object.values(guess.attributes)
    .map((attribute) => attribute.status === "exact" ? "🟩" : attribute.status === "close" ? "🟨" : "⬛")
    .join(""));
  const score = state.won ? `${state.guesses.length}/${state.maxAttempts}` : `X/${state.maxAttempts}`;
  return [`Freestyler del día · ${state.dateKey}`, score, "", ...rows, "", window.location.href].join("\n");
}

function GuessRow({ guess }: { guess: FreestylerDailyGuess }) {
  const cells = [
    guess.attributes.country,
    guess.attributes.birthYear,
    guess.attributes.fmsParticipant,
    guess.attributes.redBullInternational,
    guess.attributes.podiums,
    guess.attributes.titles,
  ];

  return (
    <div className="daily-guess-row animate-fade-in">
      <div className="daily-guess-name"><span>{guess.alias}</span></div>
      {cells.map((attribute, index) => (
        <div className={`daily-clue daily-clue--${attribute.status}`} key={index}>
          <strong>{attribute.label}</strong>
          {attribute.direction && <small>{directionLabel(attribute.direction)}</small>}
        </div>
      ))}
    </div>
  );
}

export default function FreestylerDailyClient() {
  const [sessionId, setSessionId] = useState("");
  const [state, setState] = useState<FreestylerDailyState | null>(null);
  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const currentSession = getSessionId();
    setSessionId(currentSession);

    async function load() {
      try {
        const [gameResponse, catalogResponse] = await Promise.all([
          fetch("/api/games/freestyler/today", { headers: { "x-game-session": currentSession } }),
          fetch("/api/catalog/freestylers?limit=2000"),
        ]);
        if (!gameResponse.ok || !catalogResponse.ok) throw new Error("No se pudo cargar el juego");
        const game = await gameResponse.json() as FreestylerDailyState;
        const catalog = await catalogResponse.json() as { data: CatalogOption[] };
        setState(game);
        setOptions(catalog.data.filter((option) => option.eligibleForDaily));
      } catch {
        setError("No se pudo cargar el desafío. Comprueba que el servidor esté activo.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const guessedIds = new Set(state?.guesses.map((guess) => guess.freestylerId) ?? []);
  const results = query.trim().length
    ? options.filter((option) => !guessedIds.has(option.id) && normalize(`${option.alias} ${option.realName ?? ""}`).includes(normalize(query))).slice(0, 6)
    : [];

  async function submitGuess() {
    if (!selected || !state || state.completed) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/games/freestyler/today/guesses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-game-session": sessionId },
        body: JSON.stringify({ freestylerId: selected.id }),
      });
      const body = await response.json() as FreestylerDailyState | { error: string };
      if (!response.ok) throw new Error("error" in body ? body.error : "No se pudo registrar el intento");
      setState(body as FreestylerDailyState);
      setSelected(null);
      setQuery("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo registrar el intento");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyResult() {
    if (!state) return;
    await navigator.clipboard.writeText(shareResult(state));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="daily-shell">
      <section className="daily-stage">
        <div className="daily-stage-copy">
          <p className="daily-overline"><span>Juego diario</span> {state?.dateKey || "Hoy"}</p>
          <h1>¿Quién pisa<br /><em>la tarima?</em></h1>
          <p>Ocho nombres. Seis pistas verificadas por intento. Un freestyler distinto cada día.</p>
        </div>
        <div className="daily-attempt-meter" aria-label="Intentos disponibles">
          <span>Intentos</span>
          <div>
            {Array.from({ length: state?.maxAttempts ?? 8 }, (_, index) => (
              <i className={index < (state?.guesses.length ?? 0) ? "is-used" : ""} key={index}>{index + 1}</i>
            ))}
          </div>
          <strong>{state ? state.attemptsRemaining : "—"} restantes</strong>
        </div>
      </section>

      <main className="daily-board">
        <section className="daily-entry" aria-label="Elegir freestyler">
          <div className="daily-search-wrap">
            <label htmlFor="daily-search">Tu próximo intento</label>
            <input
              id="daily-search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSelected(null); }}
              placeholder={state?.completed ? "La partida terminó" : "Escribe un alias…"}
              disabled={loading || state?.completed}
              autoComplete="off"
            />
            {results.length > 0 && !selected && (
              <div className="daily-suggestions">
                {results.map((option) => (
                  <button key={option.id} onClick={() => { setSelected(option); setQuery(option.alias); }}>
                    <span>{option.alias}<small>{option.realName}</small></span>
                    <b>{option.country.code}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="daily-submit" onClick={submitGuess} disabled={!selected || submitting || state?.completed}>
            {submitting ? "Comparando…" : "Probar nombre"}
          </button>
        </section>

        {error && <div className="daily-error">{error}</div>}

        <section className="daily-scorecard" aria-label="Pistas de intentos">
          <div className="daily-score-head">
            <span>MC</span><span>País</span><span>Nacimiento</span><span>FMS</span><span>RB Int.</span><span>Podios RB/FMS/GL</span><span>Títulos</span>
          </div>
          {loading && <div className="daily-loading">Preparando el escenario…</div>}
          {!loading && state?.guesses.length === 0 && (
            <div className="daily-empty">
              <b>La planilla está vacía.</b>
              <span>Busca un competidor para revelar la primera línea de pistas.</span>
            </div>
          )}
          {state?.guesses.map((guess) => <GuessRow guess={guess} key={guess.freestylerId} />)}
        </section>

        <div className="daily-legend">
          <span><i className="exact" /> Coincide</span>
          <span><i className="close" /> Cerca</span>
          <span><i className="miss" /> No coincide</span>
          <span>↑ La respuesta tiene más · ↓ tiene menos</span>
        </div>

        {state?.completed && state.answer && (
          <section className={`daily-result ${state.won ? "daily-result--won" : "daily-result--lost"}`}>
            <div>
              <p>{state.won ? "Punchline correcto" : "Se acabaron los intentos"}</p>
              <h2>{state.answer.alias}</h2>
              <span>{state.answer.country} · {state.won ? `${state.guesses.length} intentos` : "Vuelve mañana"}</span>
            </div>
            <button onClick={copyResult}>{copied ? "Resultado copiado" : "Compartir resultado"}</button>
          </section>
        )}
      </main>
    </div>
  );
}
