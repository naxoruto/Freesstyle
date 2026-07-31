"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { FreestylerDailyGuess, FreestylerDailyState } from "@freestyle/shared";

interface CatalogOption {
  id: string;
  alias: string;
  realName: string | null;
  eligibleForDaily: boolean;
  country: { code: string; name: string; flagEmoji: string | null };
}

const SESSION_KEY = "freestyle-arena:daily-session";
const DEMO_SESSION_KEY = "freestyle-arena:daily-demo-session";

function getSessionId(key = SESSION_KEY) {
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const sessionId = window.crypto.randomUUID();
  window.localStorage.setItem(key, sessionId);
  return sessionId;
}

function directionLabel(direction?: string) {
  if (direction === "higher") return "↑ más";
  if (direction === "lower") return "↓ menos";
  return "";
}

function formatDailyDate(dateKey?: string) {
  if (!dateKey) return "Hoy";
  const date = new Date(`${dateKey}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function nextChallengeTimestamp(dateKey?: string) {
  if (!dateKey) return null;
  const nextDate = new Date(`${dateKey}T00:00:00-03:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  return nextDate.getTime();
}

function countdown(target: number | null, now: number) {
  if (!target) return "mañana";
  const remaining = Math.max(0, target - now);
  const hours = Math.floor(remaining / 3_600_000).toString().padStart(2, "0");
  const minutes = Math.floor((remaining % 3_600_000) / 60_000).toString().padStart(2, "0");
  const seconds = Math.floor((remaining % 60_000) / 1_000).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function shareResult(state: FreestylerDailyState) {
  const rows = state.guesses.map((guess) => Object.values(guess.attributes)
    .map((attribute) => attribute.status === "exact" ? "🟩" : attribute.status === "close" ? "🟨" : "🟥")
    .join(""));
  const score = state.won ? `${state.guesses.length}/${state.maxAttempts}` : `X/${state.maxAttempts}`;
  return ["Freestyler del día", score, "", ...rows, "", window.location.href].join("\n");
}

function Rules() {
  return (
    <details className="daily-rules">
      <summary>Cómo se juega</summary>
      <div className="daily-rules-grid">
        <p><strong>Busca un MC</strong><span>Escribe un alias y selecciona un resultado para usar tu intento.</span></p>
        <p><strong>Lee las pistas</strong><span>Verde es exacto, amarillo es cercano y rojo es diferente.</span></p>
        <p><strong>Completa el reto</strong><span>Tienes ocho intentos. El desafío cambia al comenzar un nuevo día.</span></p>
      </div>
      <p className="daily-rules-note">En años y títulos, amarillo significa una diferencia de un punto. En participaciones, significa la misma cantidad en campeonatos distintos. En países, significa proximidad geográfica.</p>
    </details>
  );
}

function GuessRow({ guess }: { guess: FreestylerDailyGuess }) {
  const cells = [
    ["País", guess.attributes.country],
    ["Nacimiento", guess.attributes.birthYear],
    ["FMS", guess.attributes.fmsParticipant],
    ["Red Bull", guess.attributes.redBullInternational],
    ["Participaciones", guess.attributes.participations],
    ["Títulos", guess.attributes.titles],
  ] as const;

  return (
    <div className="daily-guess-row animate-fade-in">
      <div className="daily-guess-name"><span>{guess.alias}</span></div>
      {cells.map(([label, attribute]) => (
        <div className={`daily-clue daily-clue--${attribute.status}`} key={label}>
          <small className="daily-clue-label">{label}</small>
          <strong>{attribute.label}</strong>
          {attribute.direction && <small>{directionLabel(attribute.direction)}</small>}
          {label === "País" && attribute.status === "close" && <small>cerca</small>}
        </div>
      ))}
    </div>
  );
}

export default function FreestylerDailyClient() {
  const [isDemo] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");
  const [sessionId, setSessionId] = useState("");
  const [state, setState] = useState<FreestylerDailyState | null>(null);
  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogOption | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentSession = getSessionId(isDemo ? DEMO_SESSION_KEY : SESSION_KEY);
    setSessionId(currentSession);

    async function loadGame() {
      try {
        const response = await fetch("/api/games/freestyler/today", {
          headers: { "x-game-session": currentSession, ...(isDemo ? { "x-game-demo": "true" } : {}) },
        });
        if (!response.ok) throw new Error("No se pudo cargar el desafío");
        setState(await response.json() as FreestylerDailyState);
      } catch {
        setError("No se pudo cargar el desafío. Comprueba que el servidor esté activo.");
      } finally {
        setLoading(false);
      }
    }

    loadGame();
  }, [isDemo]);

  useEffect(() => {
    if (state?.completed) return;
    const value = query.trim();
    if (!value || selected) {
      setOptions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setCatalogError("");
      try {
        const response = await fetch(`/api/catalog/freestylers?q=${encodeURIComponent(value)}&limit=8`, { signal: controller.signal });
        if (!response.ok) throw new Error("No se pudieron buscar perfiles");
        const catalog = await response.json() as { data: CatalogOption[] };
        setOptions(catalog.data.filter((option) => option.eligibleForDaily));
        setActiveIndex(-1);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setCatalogError("No se pudo actualizar la búsqueda.");
      } finally {
        setSearching(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selected, state?.completed]);

  useEffect(() => {
    if (!state?.completed) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [state?.completed]);

  const guessedIds = new Set(state?.guesses.map((guess) => guess.freestylerId) ?? []);
  const results = options.filter((option) => !guessedIds.has(option.id));
  const listboxId = "daily-suggestions";

  function selectOption(option: CatalogOption) {
    setSelected(option);
    setQuery(option.alias);
    setOptions([]);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setOptions([]);
    inputRef.current?.focus();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectOption(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOptions([]);
    }
  }

  async function submitGuess() {
    if (!selected || !state || state.completed) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/games/freestyler/today/guesses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-game-session": sessionId,
          ...(isDemo ? { "x-game-demo": "true" } : {}),
        },
        body: JSON.stringify({ freestylerId: selected.id }),
      });
      const body = await response.json() as FreestylerDailyState | { error: string };
      if (!response.ok) throw new Error("error" in body ? body.error : "No se pudo registrar el intento");
      setState(body as FreestylerDailyState);
      setSelected(null);
      setQuery("");
      setOptions([]);
      inputRef.current?.focus();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo registrar el intento");
    } finally {
      setSubmitting(false);
    }
  }

  async function giveUp() {
    if (!state || state.completed || !window.confirm("¿Quieres rendirte y revelar la respuesta?")) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/games/freestyler/today/give-up", {
        method: "POST",
        headers: {
          "x-game-session": sessionId,
          ...(isDemo ? { "x-game-demo": "true" } : {}),
        },
      });
      const body = await response.json() as FreestylerDailyState | { error: string };
      if (!response.ok) throw new Error("error" in body ? body.error : "No se pudo cerrar la partida");
      setState(body as FreestylerDailyState);
      setSelected(null);
      setQuery("");
      setOptions([]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cerrar la partida");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyResult() {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(shareResult(state));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError("No se pudo copiar el resultado. Selecciónalo y cópialo manualmente.");
    }
  }

  const nextChallenge = countdown(nextChallengeTimestamp(state?.dateKey), now);

  function drawAnotherDemo() {
    window.localStorage.setItem(DEMO_SESSION_KEY, window.crypto.randomUUID());
    window.location.reload();
  }

  return (
    <div className="daily-shell">
      {isDemo && (
        <div className="daily-demo-banner">
          <span><strong>Modo demo</strong> Este sorteo no cambia el reto público.</span>
          <button type="button" onClick={drawAnotherDemo}>Sortear otro</button>
        </div>
      )}
      <section className="daily-stage">
        <div className="daily-stage-copy">
          <p className="daily-overline"><span>ROUND {state?.dateKey?.slice(-2) || "—"}</span> Desafío del {formatDailyDate(state?.dateKey)}</p>
          <h1>¿Quién pisa<br /><em>la tarima?</em></h1>
          <p>Ocho intentos. Seis pistas verificadas por intento. Un freestyler distinto cada día.</p>
        </div>
        <div className="daily-attempt-meter" aria-label="Intentos disponibles">
          <span>Intentos usados</span>
          <div style={{ gridTemplateColumns: `repeat(${state?.maxAttempts ?? 8}, minmax(0, 1fr))` }}>
            {Array.from({ length: state?.maxAttempts ?? 8 }, (_, index) => (
              <i className={index < (state?.guesses.length ?? 0) ? "is-used" : ""} key={index}>{index + 1}</i>
            ))}
          </div>
          <strong>{state ? `${state.guesses.length}/${state.maxAttempts}` : "—"}</strong>
        </div>
      </section>

      <main className="daily-board">
        <Rules />
        <section className="daily-entry" aria-label="Elegir freestyler">
          <div className="daily-search-wrap">
            <label htmlFor="daily-search">Tu próximo intento</label>
            <div className="daily-input-row">
              <input
                ref={inputRef}
                id="daily-search"
                role="combobox"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-expanded={results.length > 0}
                aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${results[activeIndex].id}` : undefined}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSelected(null); }}
                onKeyDown={handleSearchKeyDown}
                placeholder={state?.completed ? "La partida terminó" : "Escribe un alias…"}
                disabled={loading || state?.completed}
                autoComplete="off"
              />
              {selected && <button type="button" className="daily-change" onClick={clearSelection}>Cambiar</button>}
            </div>
            {results.length > 0 && !selected && (
              <div className="daily-suggestions" id={listboxId} role="listbox">
                {results.map((option, index) => (
                  <button
                    type="button"
                    id={`${listboxId}-${option.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? "is-active" : ""}
                    key={option.id}
                    onClick={() => selectOption(option)}
                  >
                    <span>{option.alias}<small>{option.realName || option.country.name}</small></span>
                    <b>{option.country.code}</b>
                  </button>
                ))}
              </div>
            )}
            {searching && <span className="daily-search-status">Buscando perfiles…</span>}
            {catalogError && <span className="daily-search-status daily-search-status--error">{catalogError}</span>}
          </div>
          <div className="daily-actions">
            <button className="daily-submit" onClick={submitGuess} disabled={!selected || submitting || state?.completed}>
              {submitting ? "Comparando…" : "Probar nombre"}
            </button>
            <button className="daily-give-up" onClick={giveUp} disabled={submitting || state?.completed}>
              Rendirse
            </button>
          </div>
        </section>

        {error && <div className="daily-error" role="alert">{error}</div>}
        <p className="daily-live-status" aria-live="polite">{state && !state.completed ? `Intento ${state.guesses.length} de ${state.maxAttempts}.` : ""}</p>

        <section className="daily-scorecard" aria-label="Pistas de intentos">
          <div className="daily-score-head">
            <span>MC</span><span>País</span><span>Nacimiento</span><span>FMS</span><span>Red Bull</span><span>Participaciones</span><span>Títulos</span>
          </div>
          {loading && <div className="daily-loading" role="status">Preparando el escenario…</div>}
          {!loading && state?.guesses.length === 0 && (
            <div className="daily-empty">
              <b>La planilla está vacía.</b>
              <span>Busca un competidor para revelar la primera línea de pistas.</span>
            </div>
          )}
          {state?.guesses.slice().reverse().map((guess) => <GuessRow guess={guess} key={guess.freestylerId} />)}
        </section>

        <div className="daily-legend" aria-label="Leyenda de pistas">
          <span><i className="exact" /> Exacta</span>
          <span><i className="close" /> Cerca</span>
          <span><i className="miss" /> Diferente</span>
          <span>↑ La respuesta tiene más · ↓ tiene menos</span>
        </div>

        {state?.completed && state.answer && (
          <section className={`daily-result ${state.won ? "daily-result--won" : "daily-result--lost"}`}>
            <div>
              <p>{state.won ? "Punchline correcto" : "Se acabaron los intentos"}</p>
              <h2>{state.answer.alias}</h2>
              <span>{state.answer.country} · Nació en {state.answer.birthYear} · {state.answer.participations} participaciones en {state.answer.participationCompetitions.join(", ") || "competiciones no indicadas"} · {state.answer.titles} títulos</span>
              <small className="daily-next">Nuevo desafío en {nextChallenge}</small>
            </div>
            <button onClick={copyResult}>{copied ? "Resultado copiado" : "Compartir resultado"}</button>
          </section>
        )}
      </main>
    </div>
  );
}
