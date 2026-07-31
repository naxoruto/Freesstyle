import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { mapExternalParticipationCompetition } from "./participationMapping";

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 250;

type InventoryCountRow = { count: bigint | number };
type InventoryProviderRow = { provider: string; count: bigint | number };
type InventoryWinRow = { provider: string; count: bigint | number; linked_count: bigint | number };

function toNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

function parseLimit(value: unknown) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : DEFAULT_LIMIT;
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_LIMIT) : DEFAULT_LIMIT;
}

function parseLinkedFilter(value: unknown) {
  if (value === "linked") return Prisma.sql`AND ep.linked_freestyler_id IS NOT NULL`;
  if (value === "unlinked") return Prisma.sql`AND ep.linked_freestyler_id IS NULL`;
  return Prisma.empty;
}

function parseProviderFilter(value: unknown) {
  return typeof value === "string" && value.trim()
    ? Prisma.sql`AND ep.provider = ${value.trim()}`
    : Prisma.empty;
}

export async function getInventoryReport() {
  const [totalRows, linkedRows, providerRows, dailyWinRows] = await Promise.all([
    prisma.$queryRaw<InventoryCountRow[]>`SELECT COUNT(*)::bigint AS count FROM external_profiles`,
    prisma.$queryRaw<InventoryCountRow[]>`SELECT COUNT(*)::bigint AS count FROM external_profiles WHERE linked_freestyler_id IS NOT NULL`,
    prisma.$queryRaw<InventoryProviderRow[]>`
      SELECT provider, COUNT(*)::bigint AS count
      FROM external_profiles
      GROUP BY provider
      ORDER BY provider ASC
    `,
    prisma.$queryRaw<InventoryWinRow[]>`
      SELECT ep.provider, COUNT(ew.id)::bigint AS count, COUNT(ep.linked_freestyler_id)::bigint AS linked_count
      FROM external_wins ew
      INNER JOIN external_profiles ep ON ep.id = ew.external_profile_id
      WHERE ew.counts_for_daily = true
      GROUP BY ep.provider
      ORDER BY ep.provider ASC
    `,
  ]);

  return {
    totalProfiles: toNumber(totalRows[0]?.count ?? 0),
    linkedProfiles: toNumber(linkedRows[0]?.count ?? 0),
    providers: providerRows.map((row) => ({ provider: row.provider, count: toNumber(row.count) })),
    dailyWins: dailyWinRows.map((row) => ({
      provider: row.provider,
      count: toNumber(row.count),
      linkedCount: toNumber(row.linked_count),
    })),
  };
}

export async function searchInventoryProfiles(query: unknown, requestedLimit: unknown, provider: unknown, linked: unknown) {
  const q = typeof query === "string" ? normalizeAlias(query).slice(0, 80) : "";
  const likeQuery = `%${q}%`;
  const limit = parseLimit(requestedLimit);
  const providerFilter = parseProviderFilter(provider);
  const linkedFilter = parseLinkedFilter(linked);
  const queryFilter = q
    ? Prisma.sql`AND (ep.normalized_alias LIKE ${likeQuery} OR EXISTS (
        SELECT 1 FROM external_profile_aliases epa
        WHERE epa.external_profile_id = ep.id AND epa.normalized_alias LIKE ${likeQuery}
      ))`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    provider: string;
    external_id: string;
    canonical_url: string;
    source_alias: string;
    country_code: string | null;
    birth_year: number | null;
    parse_status: string;
    linked_alias: string | null;
    linked_slug: string | null;
    aliases: string[] | null;
    participation_count: bigint | number;
    win_count: bigint | number;
    daily_win_count: bigint | number;
  }>>`
    SELECT
      ep.id,
      ep.provider,
      ep.external_id,
      ep.canonical_url,
      ep.source_alias,
      ep.country_code,
      ep.birth_year,
      ep.parse_status,
      f.alias AS linked_alias,
      f.slug AS linked_slug,
      COALESCE(array_agg(DISTINCT epa.alias) FILTER (WHERE epa.alias IS NOT NULL), '{}') AS aliases,
      COUNT(DISTINCT epart.id)::bigint AS participation_count,
      COUNT(DISTINCT ew.id)::bigint AS win_count,
      COUNT(DISTINCT ew.id) FILTER (WHERE ew.counts_for_daily = true)::bigint AS daily_win_count
    FROM external_profiles ep
    LEFT JOIN freestylers f ON f.id = ep.linked_freestyler_id
    LEFT JOIN external_profile_aliases epa ON epa.external_profile_id = ep.id
    LEFT JOIN external_participations epart ON epart.external_profile_id = ep.id
    LEFT JOIN external_wins ew ON ew.external_profile_id = ep.id
    WHERE 1 = 1
    ${providerFilter}
    ${linkedFilter}
    ${queryFilter}
    GROUP BY ep.id, f.alias, f.slug
    ORDER BY ep.provider ASC, ep.source_alias ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    canonicalUrl: row.canonical_url,
    sourceAlias: row.source_alias,
    countryCode: row.country_code,
    birthYear: row.birth_year,
    parseStatus: row.parse_status,
    linkedFreestyler: row.linked_alias ? { alias: row.linked_alias, slug: row.linked_slug } : null,
    aliases: row.aliases ?? [],
    counts: {
      participations: toNumber(row.participation_count),
      wins: toNumber(row.win_count),
      dailyWins: toNumber(row.daily_win_count),
    },
  }));
}

export async function getInventoryProfile(id: string) {
  const profiles = await prisma.$queryRaw<Array<{
    id: string;
    provider: string;
    external_id: string;
    canonical_url: string;
    source_alias: string;
    country_code: string | null;
    real_name: string | null;
    birth_year: number | null;
    parse_status: string;
    linked_alias: string | null;
    linked_slug: string | null;
  }>>`
    SELECT ep.id, ep.provider, ep.external_id, ep.canonical_url, ep.source_alias, ep.country_code, ep.real_name,
      ep.birth_year, ep.parse_status, f.alias AS linked_alias, f.slug AS linked_slug
    FROM external_profiles ep
    LEFT JOIN freestylers f ON f.id = ep.linked_freestyler_id
    WHERE ep.id = ${id}
    LIMIT 1
  `;

  const profile = profiles[0];
  if (!profile) return null;

  const [aliases, participations, wins] = await Promise.all([
    prisma.$queryRaw<Array<{ alias: string }>>`
      SELECT alias FROM external_profile_aliases WHERE external_profile_id = ${id} ORDER BY alias ASC
    `,
    prisma.$queryRaw<Array<{ competition_name: string; season: string | null; event_name: string | null; stage: string | null; source_url: string | null }>>`
      SELECT competition_name, season, event_name, stage, source_url
      FROM external_participations
      WHERE external_profile_id = ${id}
      ORDER BY competition_name ASC, season DESC NULLS LAST
      LIMIT 120
    `,
    prisma.$queryRaw<Array<{ competition_name: string; label: string; season: string | null; year: number | null; category: string; counts_for_daily: boolean; source_url: string | null }>>`
      SELECT competition_name, label, season, year, category, counts_for_daily, source_url
      FROM external_wins
      WHERE external_profile_id = ${id}
      ORDER BY counts_for_daily DESC, year DESC NULLS LAST, label ASC
      LIMIT 120
    `,
  ]);

  return {
    id: profile.id,
    provider: profile.provider,
    externalId: profile.external_id,
    canonicalUrl: profile.canonical_url,
    sourceAlias: profile.source_alias,
    countryCode: profile.country_code,
    realName: profile.real_name,
    birthYear: profile.birth_year,
    parseStatus: profile.parse_status,
    linkedFreestyler: profile.linked_alias ? { alias: profile.linked_alias, slug: profile.linked_slug } : null,
    aliases: aliases.map((item) => item.alias),
    participations: participations.map((item) => ({
      competitionName: item.competition_name,
      season: item.season,
      eventName: item.event_name,
      stage: item.stage,
      sourceUrl: item.source_url,
    })),
    wins: wins.map((item) => ({
      competitionName: item.competition_name,
      label: item.label,
      season: item.season,
      year: item.year,
      category: item.category,
      countsForDaily: item.counts_for_daily,
      sourceUrl: item.source_url,
    })),
  };
}

export async function getPendingParticipationMappings(query: unknown, requestedLimit: unknown) {
  const q = typeof query === "string" ? normalizeAlias(query).slice(0, 80) : "";
  const limit = parseLimit(requestedLimit);
  const competitions = new Map(
    (await prisma.competition.findMany({ select: { id: true, slug: true, name: true } }))
      .map((competition) => [competition.slug, competition]),
  );
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    provider: string;
    external_profile_id: string;
    source_alias: string;
    linked_alias: string;
    linked_slug: string;
    country_code: string | null;
    competition_name: string;
    normalized_competition: string;
    source_url: string | null;
  }>>`
    SELECT xp.id, ep.provider, ep.id AS external_profile_id, ep.source_alias, f.alias AS linked_alias, f.slug AS linked_slug,
      ep.country_code, xp.competition_name, xp.normalized_competition, xp.source_url
    FROM external_participations xp
    INNER JOIN external_profiles ep ON ep.id = xp.external_profile_id
    INNER JOIN freestylers f ON f.id = ep.linked_freestyler_id
    WHERE ep.linked_freestyler_id IS NOT NULL
    ORDER BY xp.competition_name ASC, f.alias ASC
  `;

  const pending = [];
  for (const row of rows) {
    if (mapExternalParticipationCompetition(row.normalized_competition, competitions)) continue;
    const haystack = normalizeAlias(`${row.source_alias} ${row.linked_alias} ${row.competition_name}`);
    if (q && !haystack.includes(q)) continue;
    pending.push({
      id: row.id,
      provider: row.provider,
      externalProfileId: row.external_profile_id,
      sourceAlias: row.source_alias,
      linkedFreestyler: { alias: row.linked_alias, slug: row.linked_slug },
      countryCode: row.country_code,
      competitionName: row.competition_name,
      normalizedCompetition: row.normalized_competition,
      sourceUrl: row.source_url,
      reason: "competencia_sin_mapeo",
    });
    if (pending.length >= limit) break;
  }

  return { data: pending, totalUnmapped: rows.filter((row) => !mapExternalParticipationCompetition(row.normalized_competition, competitions)).length };
}
