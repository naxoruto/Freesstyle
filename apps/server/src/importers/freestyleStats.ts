import type { PrismaClient } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { isPlausibleBirthYear } from "./fandom";

const BASE_URL = "https://freestylestats.com";

interface StatsProfile {
  realName?: string;
  birthYear?: number;
  competitionCandidates: string[];
}

export function freestyleStatsSlug(alias: string): string {
  return normalizeAlias(alias).replace(/\s+/g, "");
}

function cleanHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseFreestyleStatsProfile(html: string): StatsProfile {
  const text = cleanHtml(html);
  const realName = /Nombre real\s+(.+?)\s+Nacimiento\b/i.exec(text)?.[1]?.trim();
  const birthYear = /Nacimiento\s+.*?\b(19\d{2}|20\d{2})\b/i.exec(text)?.[1];
  const competitionCandidates = [...html.matchAll(/href="\/competition\/[^"?#]+"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => cleanHtml(match[1]))
    .filter((name) => name.length > 1 && name.length <= 120)
    .filter((name, index, all) => all.indexOf(name) === index);

  return {
    realName: realName && realName.length <= 120 ? realName : undefined,
    birthYear: birthYear ? Number(birthYear) : undefined,
    competitionCandidates,
  };
}

export interface FreestyleStatsImportResult {
  requested: number;
  found: number;
  updated: number;
  missing: number;
}

export async function importFreestyleStatsProfiles(prisma: PrismaClient): Promise<FreestyleStatsImportResult> {
  const profiles = await prisma.freestyler.findMany({
    select: { id: true, alias: true, realName: true, birthYear: true, aliases: { select: { alias: true } } },
    orderBy: { alias: "asc" },
  });
  const result: FreestyleStatsImportResult = { requested: profiles.length, found: 0, updated: 0, missing: 0 };

  for (const profile of profiles) {
    const slugs = [profile.alias, ...profile.aliases.map((alias) => alias.alias)].map(freestyleStatsSlug);
    let response: Response | undefined;
    let profileUrl = "";
    for (const slug of [...new Set(slugs)]) {
      const url = `${BASE_URL}/profile/${encodeURIComponent(slug)}`;
      const candidate = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
      if (candidate.ok) {
        response = candidate;
        profileUrl = url;
        break;
      }
    }
    if (!response) {
      result.missing += 1;
      continue;
    }

    result.found += 1;
    const parsed = parseFreestyleStatsProfile(await response.text());
    const source = await prisma.dataSource.upsert({
      where: { url: profileUrl },
      update: { name: `Freestyle Stats: ${profile.alias}`, accessedAt: new Date() },
      create: { name: `Freestyle Stats: ${profile.alias}`, url: profileUrl, accessedAt: new Date() },
    });
    await prisma.freestyler.update({
      where: { id: profile.id },
      data: {
        realName: profile.realName || parsed.realName,
        birthYear: profile.birthYear || (parsed.birthYear && isPlausibleBirthYear(parsed.birthYear) ? parsed.birthYear : undefined),
        sources: { connectOrCreate: { where: { freestylerId_sourceId: { freestylerId: profile.id, sourceId: source.id } }, create: { sourceId: source.id } } },
      },
    });
    if (parsed.competitionCandidates.length) {
      await prisma.dataReviewIssue.upsert({
        where: { freestylerId_key: { freestylerId: profile.id, key: "freestyle-stats-competition-candidates" } },
        update: { summary: "Participaciones y títulos de Freestyle Stats pendientes de contraste", details: { candidates: parsed.competitionCandidates, source: profileUrl }, status: "OPEN" },
        create: { freestylerId: profile.id, key: "freestyle-stats-competition-candidates", summary: "Participaciones y títulos de Freestyle Stats pendientes de contraste", details: { candidates: parsed.competitionCandidates, source: profileUrl } },
      });
    }
    result.updated += 1;
  }

  return result;
}
