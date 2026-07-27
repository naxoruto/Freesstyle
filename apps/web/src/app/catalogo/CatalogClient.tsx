"use client";

import { useEffect, useState } from "react";

interface CatalogFreestyler {
  id: string;
  slug: string;
  alias: string;
  realName: string | null;
  active: boolean;
  birthYear: number | null;
  debutYear: number | null;
  fmsParticipant: boolean | null;
  redBullInternational: boolean | null;
  eligibleForDaily: boolean;
  styles: Array<{ rank: number; styleTag: { slug: string; name: string } }>;
  country: {
    code: string;
    name: string;
    flagEmoji: string | null;
  };
  _count: {
    sources: number;
    reviewIssues: number;
    titles: number;
    participations: number;
  };
}

interface CatalogProfile {
  alias: string;
  realName: string | null;
  birthYear: number | null;
  debutYear: number | null;
  fmsParticipant: boolean | null;
  redBullInternational: boolean | null;
  country: CatalogFreestyler["country"];
  aliases: Array<{ alias: string }>;
  styles: Array<{ rank: number; styleTag: { name: string } }>;
  titles: Array<{ label: string | null; wonAt: string | null; competition: { name: string } }>;
  participations: Array<{ finalPosition: number | null; competition: { name: string }; season: { name: string } | null }>;
  sources: Array<{ source: { name: string; url: string } }>;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function CatalogClient() {
  const [freestylers, setFreestylers] = useState<CatalogFreestyler[]>([]);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<CatalogProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const response = await fetch("/api/catalog/freestylers?limit=100");
        if (!response.ok) throw new Error("No se pudo consultar el catálogo");
        const body = (await response.json()) as { data: CatalogFreestyler[] };
        if (!cancelled) setFreestylers(body.data);
      } catch {
        if (!cancelled) setError("El catálogo no está disponible. Comprueba que el servidor esté activo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalog();
    return () => { cancelled = true; };
  }, []);

  const countries = Array.from(
    new Map(freestylers.map((freestyler) => [freestyler.country.code, freestyler.country])).values(),
  );
  const normalizedQuery = normalize(query.trim());
  const visibleFreestylers = freestylers.filter((freestyler) => {
    const matchesCountry = country === "ALL" || freestyler.country.code === country;
    const matchesQuery = !normalizedQuery || normalize(`${freestyler.alias} ${freestyler.realName ?? ""}`).includes(normalizedQuery);
    return matchesCountry && matchesQuery;
  });
  const birthCoverage = freestylers.filter((freestyler) => freestyler.birthYear).length;
  const eligibleProfiles = freestylers.filter((freestyler) => freestyler.eligibleForDaily).length;
  const openIssues = freestylers.reduce((total, freestyler) => total + freestyler._count.reviewIssues, 0);

  async function openProfile(slug: string) {
    setProfileLoading(true);
    setProfile(null);
    try {
      const response = await fetch(`/api/catalog/freestylers/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error("No se pudo cargar el perfil");
      const body = await response.json() as { data: CatalogProfile };
      setProfile(body.data);
    } catch {
      setError("No se pudo cargar la ficha del freestyler.");
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <div className="catalog-shell">
      <section className="catalog-hero">
        <div className="catalog-hero-index" aria-hidden="true">{String(freestylers.length || 30).padStart(2, "0")}</div>
        <div className="catalog-hero-copy">
          <p className="catalog-kicker"><span /> Archivo de competidores</p>
          <h1>El roster<br /><em>hispano.</em></h1>
          <p className="catalog-intro">
            Una base viva de MCs, procedencias y trayectorias. Cada dato conserva su fuente;
            lo dudoso se marca antes de entrar al juego.
          </p>
        </div>
        <dl className="catalog-stats" aria-label="Estado del catálogo">
          <div><dt>Perfiles</dt><dd>{freestylers.length || "—"}</dd></div>
          <div><dt>Con nacimiento</dt><dd>{birthCoverage || "—"}</dd></div>
          <div><dt>Listos para jugar</dt><dd>{eligibleProfiles || "—"}</dd></div>
          <div><dt>Incidencias</dt><dd>{openIssues || "—"}</dd></div>
        </dl>
      </section>

      <section className="catalog-workbench">
        <div className="catalog-tools">
          <label className="catalog-search">
            <span>Buscar alias o nombre</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Aczino, Wos, Marithea…"
            />
          </label>
          <div className="catalog-country-filter" aria-label="Filtrar por país">
            <button className={country === "ALL" ? "is-active" : ""} onClick={() => setCountry("ALL")}>Todos</button>
            {countries.map((item) => (
              <button
                key={item.code}
                className={country === item.code ? "is-active" : ""}
                onClick={() => setCountry(item.code)}
                title={item.name}
              >
                {item.code}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-result-line">
          <span>{loading ? "Leyendo archivo" : `${visibleFreestylers.length} competidores`}</span>
          <span>Actualizado 27.07.2026</span>
        </div>

        {error && <div className="catalog-error">{error}</div>}

        {loading ? (
          <div className="catalog-grid" aria-label="Cargando catálogo">
            {Array.from({ length: 6 }, (_, index) => <div className="catalog-card catalog-card--loading" key={index} />)}
          </div>
        ) : (
          <div className="catalog-grid">
            {visibleFreestylers.map((freestyler, index) => (
              <button className="catalog-card" key={freestyler.id} onClick={() => void openProfile(freestyler.slug)}>
                <div className="catalog-card-rail">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{freestyler.country.code}</b>
                </div>
                <div className="catalog-card-main">
                  <div className="catalog-card-country">
                    <span>{freestyler.country.flagEmoji}</span>
                    {freestyler.country.name}
                    <b className={freestyler.eligibleForDaily ? "is-ready" : "needs-data"}>
                      {freestyler.eligibleForDaily ? "Listo" : "Incompleto"}
                    </b>
                  </div>
                  <h2>{freestyler.alias}</h2>
                  <p className="catalog-real-name">{freestyler.realName || "Nombre civil por verificar"}</p>
                  <p className="catalog-style-line">
                    {freestyler.styles.map((style) => style.styleTag.name).join(" / ") || "Estilo por clasificar"}
                  </p>
                  <dl className="catalog-facts">
                    <div><dt>Nacimiento</dt><dd>{freestyler.birthYear || "—"}</dd></div>
                    <div><dt>RB Internacional</dt><dd>{freestyler.redBullInternational ? "Sí" : "No"}</dd></div>
                    <div><dt>Títulos</dt><dd>{freestyler._count.titles}</dd></div>
                  </dl>
                  <div className="catalog-card-status">
                    <span className={freestyler._count.reviewIssues ? "has-review" : "is-clear"}>
                      {`${freestyler._count.sources} fuentes · ${freestyler._count.reviewIssues} incidencia${freestyler._count.reviewIssues === 1 ? "" : "s"}`}
                    </span>
                    <span className="catalog-barcode" aria-hidden="true" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && !error && visibleFreestylers.length === 0 && (
          <div className="catalog-empty">No hay competidores que coincidan con esos filtros.</div>
        )}

        <footer className="catalog-source-note">
          Datos contrastados con FMS y <a href="https://rap.fandom.com/es/wiki/Categor%C3%ADa:Freestylers" target="_blank" rel="noreferrer">Wiki Rap</a>.
          El contenido derivado de Wiki Rap se atribuye bajo CC BY-SA. No utilizamos sus imágenes.
        </footer>
      </section>
      {(profile || profileLoading) && (
        <div className="catalog-profile-backdrop" role="presentation" onClick={() => setProfile(null)}>
          <aside className="catalog-profile" role="dialog" aria-modal="true" aria-label="Ficha de freestyler" onClick={(event) => event.stopPropagation()}>
            <button className="catalog-profile-close" onClick={() => setProfile(null)} aria-label="Cerrar ficha">×</button>
            {profileLoading ? <p>Cargando ficha…</p> : profile && <>
              <p className="catalog-kicker"><span /> {profile.country.flagEmoji} {profile.country.name}</p>
              <h2>{profile.alias}</h2>
              <p className="catalog-real-name">{profile.realName || "Nombre civil sin confirmar"}</p>
              {profile.aliases.length > 0 && <p className="catalog-profile-aka">AKA: {profile.aliases.map(({ alias }) => alias).join(" · ")}</p>}
              <dl className="catalog-profile-facts">
                <div><dt>Nacimiento</dt><dd>{profile.birthYear || "—"}</dd></div>
                <div><dt>FMS</dt><dd>{profile.fmsParticipant === null ? "—" : profile.fmsParticipant ? "Sí" : "No"}</dd></div>
                <div><dt>RB Internacional</dt><dd>{profile.redBullInternational === null ? "—" : profile.redBullInternational ? "Sí" : "No"}</dd></div>
              </dl>
              <section><h3>Títulos ganados</h3>{profile.titles.length ? <ul>{profile.titles.map((title, index) => <li key={`${title.label}-${index}`}><b>{title.label || title.competition.name}</b><span>{title.competition.name}</span></li>)}</ul> : <p>Sin títulos verificados todavía.</p>}</section>
              <section><h3>Participaciones</h3>{profile.participations.length ? <ul>{profile.participations.map((item, index) => <li key={`${item.competition.name}-${index}`}><b>{item.competition.name}</b><span>{item.season?.name || "Registro histórico"}{item.finalPosition ? ` · Puesto ${item.finalPosition}` : ""}</span></li>)}</ul> : <p>Sin participaciones verificadas todavía.</p>}</section>
              <section><h3>Fuentes</h3><ul>{profile.sources.map(({ source }) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></li>)}</ul></section>
            </>}
          </aside>
        </div>
      )}
    </div>
  );
}
