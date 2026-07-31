"use client";

import { useEffect, useState } from "react";

interface InventoryReport {
  totalProfiles: number;
  linkedProfiles: number;
  providers: Array<{ provider: string; count: number }>;
  dailyWins: Array<{ provider: string; count: number; linkedCount: number }>;
}

interface InventoryProfileSummary {
  id: string;
  provider: string;
  externalId: string;
  canonicalUrl: string;
  sourceAlias: string;
  countryCode: string | null;
  birthYear: number | null;
  parseStatus: string;
  linkedFreestyler: { alias: string; slug: string | null } | null;
  aliases: string[];
  counts: { participations: number; wins: number; dailyWins: number };
}

interface InventoryProfile extends Omit<InventoryProfileSummary, "counts"> {
  realName: string | null;
  participations: Array<{ competitionName: string; season: string | null; eventName: string | null; stage: string | null; sourceUrl: string | null }>;
  wins: Array<{ competitionName: string; label: string; season: string | null; year: number | null; category: string; countsForDaily: boolean; sourceUrl: string | null }>;
}

interface PendingParticipation {
  id: string;
  provider: string;
  externalProfileId: string;
  sourceAlias: string;
  linkedFreestyler: { alias: string; slug: string | null };
  countryCode: string | null;
  competitionName: string;
  normalizedCompetition: string;
  sourceUrl: string | null;
  reason: string;
}

const providerLabels: Record<string, string> = {
  fandom: "Fandom",
  "freestyle-stats": "FreestyleStats",
};

function providerName(provider: string) {
  return providerLabels[provider] ?? provider;
}

export default function InventoryClient() {
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [profiles, setProfiles] = useState<InventoryProfileSummary[]>([]);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("ALL");
  const [linked, setLinked] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<InventoryProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [pending, setPending] = useState<PendingParticipation[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingLoading, setPendingLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        const response = await fetch("/api/inventory/report");
        if (!response.ok) throw new Error("No se pudo consultar el reporte");
        const body = await response.json() as { data: InventoryReport };
        if (!cancelled) setReport(body.data);
      } catch {
        if (!cancelled) setError("El inventario no está disponible. Comprueba que el servidor esté activo.");
      }
    }

    void loadReport();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "120" });
        if (query.trim()) params.set("q", query.trim());
        if (provider !== "ALL") params.set("provider", provider);
        if (linked !== "ALL") params.set("linked", linked);
        const response = await fetch(`/api/inventory/profiles?${params.toString()}`);
        if (!response.ok) throw new Error("No se pudo consultar el inventario");
        const body = await response.json() as { data: InventoryProfileSummary[] };
        if (!cancelled) setProfiles(body.data);
      } catch {
        if (!cancelled) setError("No se pudo cargar la lista de perfiles externos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfiles();
    return () => { cancelled = true; };
  }, [query, provider, linked]);

  useEffect(() => {
    let cancelled = false;

    async function loadPending() {
      setPendingLoading(true);
      try {
        const params = new URLSearchParams({ limit: "120" });
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`/api/inventory/pending-participations?${params.toString()}`);
        if (!response.ok) throw new Error("No se pudo consultar pendientes");
        const body = await response.json() as { data: PendingParticipation[]; totalUnmapped: number };
        if (!cancelled) {
          setPending(body.data);
          setPendingTotal(body.totalUnmapped);
        }
      } catch {
        if (!cancelled) setError("No se pudo cargar la lista de participaciones pendientes.");
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    }

    void loadPending();
    return () => { cancelled = true; };
  }, [query]);

  async function openProfile(id: string) {
    setProfileLoading(true);
    setProfile(null);
    try {
      const response = await fetch(`/api/inventory/profiles/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error("No se pudo cargar el perfil externo");
      const body = await response.json() as { data: InventoryProfile };
      setProfile(body.data);
    } catch {
      setError("No se pudo cargar la ficha externa.");
    } finally {
      setProfileLoading(false);
    }
  }

  const dailyWins = report?.dailyWins.reduce((total, item) => total + item.count, 0) ?? 0;
  const linkedDailyWins = report?.dailyWins.reduce((total, item) => total + item.linkedCount, 0) ?? 0;

  return (
    <div className="inventory-shell">
      <section className="inventory-hero">
        <div>
          <p className="catalog-kicker"><span /> Inventario externo</p>
          <h1>Fuentes<br /><em>cruzadas.</em></h1>
          <p className="catalog-intro">
            Explorador de perfiles importados desde Fandom y FreestyleStats. Sirve para revisar vínculos,
            participaciones y victorias candidatas antes de promocionar datos al catálogo principal.
          </p>
        </div>
        <dl className="catalog-stats" aria-label="Estado del inventario">
          <div><dt>Total externo</dt><dd>{report?.totalProfiles ?? "-"}</dd></div>
          <div><dt>Vinculados</dt><dd>{report?.linkedProfiles ?? "-"}</dd></div>
          <div><dt>Wins Daily</dt><dd>{dailyWins || "-"}</dd></div>
          <div><dt>Wins vinculadas</dt><dd>{linkedDailyWins || "-"}</dd></div>
        </dl>
      </section>

      <section className="inventory-workbench">
        <div className="catalog-tools">
          <label className="catalog-search">
            <span>Buscar alias externo</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Aczino, Anubis, Chuty..."
            />
          </label>
          <div className="inventory-filters" aria-label="Filtros de inventario">
            <button className={provider === "ALL" ? "is-active" : ""} onClick={() => setProvider("ALL")}>Todas</button>
            {(report?.providers ?? []).map((item) => (
              <button key={item.provider} className={provider === item.provider ? "is-active" : ""} onClick={() => setProvider(item.provider)}>
                {providerName(item.provider)} · {item.count}
              </button>
            ))}
            <button className={linked === "linked" ? "is-active" : ""} onClick={() => setLinked(linked === "linked" ? "ALL" : "linked")}>Vinculados</button>
            <button className={linked === "unlinked" ? "is-active" : ""} onClick={() => setLinked(linked === "unlinked" ? "ALL" : "unlinked")}>Sin vínculo</button>
          </div>
        </div>

        <div className="catalog-result-line">
          <span>{loading ? "Leyendo inventario" : `${profiles.length} perfiles mostrados`}</span>
          <span>Fandom + FreestyleStats</span>
        </div>

        {error && <div className="catalog-error">{error}</div>}

        <div className="inventory-table" role="table" aria-label="Perfiles externos">
          <div className="inventory-row inventory-row--head" role="row">
            <span>Fuente</span><span>Alias</span><span>País</span><span>Vínculo</span><span>Evidencia</span>
          </div>
          {loading ? Array.from({ length: 8 }, (_, index) => <div className="inventory-row inventory-row--loading" key={index} />) : profiles.map((item) => (
            <button className="inventory-row" role="row" key={item.id} onClick={() => void openProfile(item.id)}>
              <span>{providerName(item.provider)}</span>
              <strong>{item.sourceAlias}<small>{item.aliases.slice(0, 3).join(" · ")}</small></strong>
              <span>{item.countryCode || "-"}{item.birthYear ? ` / ${item.birthYear}` : ""}</span>
              <span className={item.linkedFreestyler ? "is-linked" : "is-unlinked"}>{item.linkedFreestyler?.alias ?? "Sin vínculo"}</span>
              <span>{item.counts.wins} wins · {item.counts.dailyWins} Daily · {item.counts.participations} part.</span>
            </button>
          ))}
        </div>

        {!loading && !error && profiles.length === 0 && <div className="catalog-empty">No hay perfiles externos para esos filtros.</div>}

        <section className="inventory-pending">
          <div className="inventory-section-head">
            <div>
              <p className="catalog-kicker"><span /> Revisión manual</p>
              <h2>Participaciones sin mapeo</h2>
            </div>
            <p>{pendingLoading ? "Leyendo pendientes" : `${pending.length} mostradas de ${pendingTotal}`}</p>
          </div>
          <p className="inventory-section-copy">
            Estas participaciones pertenecen a perfiles ya vinculados, pero la competencia externa no coincide todavía con una competencia local segura.
          </p>
          <div className="inventory-table inventory-table--pending" role="table" aria-label="Participaciones pendientes de mapeo">
            <div className="inventory-row inventory-row--head" role="row">
              <span>MC</span><span>Competencia externa</span><span>Fuente</span><span>País</span><span>Motivo</span>
            </div>
            {pendingLoading ? Array.from({ length: 5 }, (_, index) => <div className="inventory-row inventory-row--loading" key={index} />) : pending.map((item) => (
              <button className="inventory-row" role="row" key={item.id} onClick={() => void openProfile(item.externalProfileId)}>
                <strong>{item.linkedFreestyler.alias}<small>{item.sourceAlias}</small></strong>
                <span title={item.normalizedCompetition}>{item.competitionName}</span>
                <span>{providerName(item.provider)}</span>
                <span>{item.countryCode || "-"}</span>
                <span>{item.reason}</span>
              </button>
            ))}
          </div>
          {!pendingLoading && pending.length === 0 && <div className="catalog-empty">No hay pendientes para esa búsqueda.</div>}
        </section>
      </section>

      {(profile || profileLoading) && (
        <div className="catalog-profile-backdrop" role="presentation" onClick={() => setProfile(null)}>
          <aside className="catalog-profile inventory-profile" role="dialog" aria-modal="true" aria-label="Ficha externa" onClick={(event) => event.stopPropagation()}>
            <button className="catalog-profile-close" onClick={() => setProfile(null)} aria-label="Cerrar ficha">x</button>
            {profileLoading ? <p>Cargando ficha...</p> : profile && <>
              <p className="catalog-kicker"><span /> {providerName(profile.provider)} · {profile.countryCode || "sin país"}</p>
              <h2>{profile.sourceAlias}</h2>
              <p className="catalog-real-name">{profile.realName || "Nombre civil sin dato"}</p>
              <p className="catalog-profile-aka">{profile.linkedFreestyler ? `Vinculado a ${profile.linkedFreestyler.alias}` : "Sin vínculo local"}</p>
              <dl className="catalog-profile-facts">
                <div><dt>Nacimiento</dt><dd>{profile.birthYear || "-"}</dd></div>
                <div><dt>Alias</dt><dd>{profile.aliases.length}</dd></div>
                <div><dt>Estado</dt><dd>{profile.parseStatus}</dd></div>
              </dl>
              <section><h3>Fuente</h3><ul><li><a href={profile.canonicalUrl} target="_blank" rel="noreferrer">{profile.canonicalUrl}</a></li></ul></section>
              <section><h3>Victorias externas</h3>{profile.wins.length ? <ul>{profile.wins.map((win, index) => <li key={`${win.label}-${index}`}><b>{win.label}</b><span>{win.competitionName}{win.year ? ` · ${win.year}` : ""} · {win.category}{win.countsForDaily ? " · cuenta Daily" : ""}</span></li>)}</ul> : <p>Sin victorias importadas.</p>}</section>
              <section><h3>Participaciones externas</h3>{profile.participations.length ? <ul>{profile.participations.map((item, index) => <li key={`${item.competitionName}-${index}`}><b>{item.competitionName}</b><span>{[item.season, item.eventName, item.stage].filter(Boolean).join(" · ") || "Registro externo"}</span></li>)}</ul> : <p>Sin participaciones importadas.</p>}</section>
            </>}
          </aside>
        </div>
      )}
    </div>
  );
}
