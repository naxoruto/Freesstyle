import type { PrismaClient } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";

const BASE_URL = "https://freestylestats.com";
const IMPORT_SOURCE = "freestyle-stats-battle";

interface ParsedBattle {
  competitor1: string;
  competitor2: string;
  competition: string;
  season: string;
  stage: string;
  score1?: number;
  score2?: number;
}

function cleanText(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseFreestyleStatsBattle(html: string): ParsedBattle | null {
  const text = cleanText(html);
  const title = /(.+?)\s+vs\s+(.+?)\s+-\s+(.+?)\s+-\s+(.+?)\s+-\s+(.+?)(?:\s+\||$)/i.exec(text);
  if (!title) return null;
  const [, competitor1, competitor2, competition, season, stage] = title.map((part) => part.trim());
  const score = new RegExp(`${competitor1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)\\s*-\\s*${competitor2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)`, "i").exec(text);
  return {
    competitor1,
    competitor2,
    competition,
    season,
    stage,
    score1: score ? Number(score[1]) : undefined,
    score2: score ? Number(score[2]) : undefined,
  };
}

function canonicalCompetition(name: string) {
  const normalized = normalizeAlias(name);
  if (normalized.startsWith("fms")) return { slug: "fms", name: "Freestyle Master Series", organizer: "Urban Roosters" };
  if (normalized.startsWith("red bull")) return { slug: "red-bull-batalla", name: "Red Bull Batalla", organizer: "Red Bull" };
  if (normalized.startsWith("god level")) return { slug: "god-level", name: "God Level", organizer: "God Level" };
  return { slug: normalized.replace(/\s+/g, "-"), name, organizer: "Freestyle Stats" };
}

async function battleUrls() {
  const response = await fetch(`${BASE_URL}/sitemap.xml`, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
  if (!response.ok) throw new Error(`Freestyle Stats respondió ${response.status} al consultar el sitemap`);
  const sitemap = await response.text();
  return [...sitemap.matchAll(/<loc>(https:\/\/freestylestats\.com\/battle\/([a-f0-9]{24}))<\/loc>/gi)]
    .map((match) => ({ url: match[1], externalId: match[2] }));
}

export async function importFreestyleStatsBattles(prisma: PrismaClient, limit = 100) {
  const profiles = await prisma.freestyler.findMany({
    select: { id: true, normalizedAlias: true, aliases: { select: { normalizedAlias: true } } },
  });
  const localByAlias = new Map<string, string>();
  for (const profile of profiles) {
    localByAlias.set(profile.normalizedAlias, profile.id);
    for (const alias of profile.aliases) localByAlias.set(alias.normalizedAlias, profile.id);
  }
  const urls = await battleUrls();
  const [records, existingBattles] = await Promise.all([
    prisma.importRecord.findMany({ where: { source: IMPORT_SOURCE }, select: { key: true } }),
    prisma.battle.findMany({ where: { externalId: { not: null } }, select: { externalId: true } }),
  ]);
  const seenKeys = new Set(records.map((record) => record.key));
  for (const battle of existingBattles) {
    if (battle.externalId) seenKeys.add(`${IMPORT_SOURCE}:${battle.externalId}`);
  }
  let scanned = 0;
  let imported = 0;
  let unmatched = 0;

  for (const battle of urls) {
    if (scanned >= limit) break;
    const importKey = `${IMPORT_SOURCE}:${battle.externalId}`;
    if (seenKeys.has(importKey)) continue;
    scanned += 1;
    const response = await fetch(battle.url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
    if (!response.ok) continue;
    const parsed = parseFreestyleStatsBattle(await response.text());
    if (!parsed) {
      await prisma.importRecord.create({ data: { key: importKey, source: IMPORT_SOURCE, status: "UNPARSABLE" } });
      continue;
    }
    const competitor1Id = localByAlias.get(normalizeAlias(parsed.competitor1));
    const competitor2Id = localByAlias.get(normalizeAlias(parsed.competitor2));
    if (!competitor1Id || !competitor2Id || competitor1Id === competitor2Id) {
      unmatched += 1;
      await prisma.importRecord.create({ data: { key: importKey, source: IMPORT_SOURCE, status: "UNMATCHED" } });
      continue;
    }
    const competitionData = canonicalCompetition(parsed.competition);
    const competition = await prisma.competition.upsert({ where: { slug: competitionData.slug }, update: { name: competitionData.name, organizer: competitionData.organizer }, create: competitionData });
    const source = await prisma.dataSource.upsert({ where: { url: battle.url }, update: { name: `Freestyle Stats: ${parsed.competitor1} vs ${parsed.competitor2}`, accessedAt: new Date() }, create: { name: `Freestyle Stats: ${parsed.competitor1} vs ${parsed.competitor2}`, url: battle.url, accessedAt: new Date() } });
    const winnerId = parsed.score1 === undefined || parsed.score2 === undefined || parsed.score1 === parsed.score2
      ? undefined
      : parsed.score1 > parsed.score2 ? competitor1Id : competitor2Id;
    await prisma.battle.create({
      data: { externalId: battle.externalId, competitor1Id, competitor2Id, winnerId, competitionId: competition.id, stage: `${parsed.season} · ${parsed.stage}`, sourceId: source.id },
    });
    await prisma.importRecord.create({ data: { key: importKey, source: IMPORT_SOURCE, status: "IMPORTED" } });
    imported += 1;
  }
  return { available: urls.length, scanned, imported, unmatched, remaining: urls.length - seenKeys.size - scanned };
}
