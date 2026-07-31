import { prisma } from "../db/prisma";
import { normalizeAlias } from "../catalog/normalizeAlias";
import {
  completeImportRun,
  createImportRun,
  replaceExternalAliases,
  replaceExternalParticipations,
  replaceExternalWins,
  upsertExternalProfile,
  type ExternalParticipationInput,
  type ExternalWinInput,
} from "./inventoryPersistence";
import { classifyWin, cleanText, countryCodeFromText, parseSpanishDate, yearFromText } from "./inventoryShared";

const PROVIDER = "freestyle-stats";
const SITEMAP_URL = "https://freestylestats.com/sitemap.xml";

function profileSlug(url: string) {
  return decodeURIComponent(url.replace(/^https:\/\/freestylestats\.com\/profile\//, "").replace(/\/$/, ""));
}

async function profileUrls() {
  const response = await fetch(SITEMAP_URL, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
  if (!response.ok) throw new Error(`Freestyle Stats respondió ${response.status} al consultar sitemap`);
  const sitemap = await response.text();
  return [...sitemap.matchAll(/<loc>(https:\/\/freestylestats\.com\/profile\/[^<]+)<\/loc>/gi)]
    .map((match) => match[1])
    .filter((url, index, all) => all.indexOf(url) === index)
    .sort();
}

function parseProfile(html: string, url: string) {
  const text = cleanText(html);
  const titleAlias = /<title>(.*?)\s+\(@/i.exec(html)?.[1]?.trim();
  const h1Alias = /<h1[^>]*>(.*?)<\/h1>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, "").trim();
  const alias = titleAlias || h1Alias || profileSlug(url);
  const realName = /Nombre real\s+(.+?)\s+Nacimiento\b/i.exec(text)?.[1]?.trim() ?? null;
  const birth = parseSpanishDate(text);
  const birthYear = birth.birthYear ?? (/Nacimiento\s+.*?\b(19\d{2}|20\d{2})\b/i.exec(text)?.[1] ? Number(/Nacimiento\s+.*?\b(19\d{2}|20\d{2})\b/i.exec(text)?.[1]) : null);
  const birthBlockCountry = /Nacimiento\s+.*?(?:\(\d+\s+años\)\s+)?(.+?)\s+Redes sociales/i.exec(text)?.[1]?.trim();
  const countryCode = countryCodeFromText(birthBlockCountry ?? "") ?? countryCodeFromText(text);
  const participations: ExternalParticipationInput[] = [...html.matchAll(/href="\/competition\/([^"?#]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      competitionName: cleanText(match[2]),
      sourceUrl: `https://freestylestats.com/competition/${match[1]}`,
    }))
    .filter((item) => item.competitionName.length > 1 && item.competitionName.length <= 160)
    .filter((item, index, all) => all.findIndex((other) => normalizeAlias(other.competitionName) === normalizeAlias(item.competitionName)) === index);

  const titlesSection = text.split("Últimos títulos")[1]?.split("Últimas jornadas")[0] ?? "";
  const wins: ExternalWinInput[] = [...titlesSection.matchAll(/(.+?)\s+Medalla de (oro|plata|bronce)/gi)]
    .filter((match) => match[2].toLowerCase() === "oro")
    .map((match) => {
      const item = match[1].replace(/^\s*Ver todos\s*/i, "").trim();
      const parsed = /^(.+?)\s+Temporada\s+(.+)$/.exec(item);
      const competitionName = parsed?.[1]?.trim() ?? item;
      const season = parsed?.[2]?.trim() ?? null;
      const label = `${competitionName} Temporada ${season}`;
      const classification = classifyWin(label);
      return { competitionName, label, season, year: season ? yearFromText(season) : null, ...classification, sourceUrl: url };
    })
    .filter((item) => item.competitionName.length > 1 && item.competitionName.length <= 160)
    .filter((item, index, all) => all.findIndex((other) => normalizeAlias(other.label) === normalizeAlias(item.label)) === index);

  return {
    alias,
    realName,
    countryCode,
    birthDate: birth.birthDate,
    birthYear,
    aliases: [alias],
    participations,
    wins,
  };
}

async function processUrl(runId: string, url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const parsed = parseProfile(html, url);
  const externalProfileId = await upsertExternalProfile(prisma, {
    provider: PROVIDER,
    externalId: profileSlug(url),
    canonicalUrl: url,
    sourceAlias: parsed.alias,
    countryCode: parsed.countryCode,
    realName: parsed.realName,
    birthDate: parsed.birthDate,
    birthYear: parsed.birthYear,
    payload: JSON.parse(JSON.stringify({
      url,
      participations: parsed.participations,
      wins: parsed.wins,
    })),
    runId,
  });
  await replaceExternalAliases(prisma, externalProfileId, parsed.aliases);
  await replaceExternalParticipations(prisma, externalProfileId, parsed.participations);
  await replaceExternalWins(prisma, externalProfileId, parsed.wins);
}

async function main() {
  const urls = await profileUrls();
  const limit = Number.parseInt(process.env.FREESTYLE_STATS_PROFILE_LIMIT ?? "0", 10) || urls.length;
  const concurrency = Math.min(Math.max(Number.parseInt(process.env.FREESTYLE_STATS_PROFILE_CONCURRENCY ?? "8", 10) || 8, 1), 16);
  const selected = urls.slice(0, limit);
  const runId = await createImportRun(prisma, PROVIDER, "profile-inventory", { sitemapUrl: SITEMAP_URL, totalProfiles: urls.length, limit: selected.length });
  let fetched = 0;
  let parsed = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < selected.length) {
      const url = selected[cursor];
      cursor += 1;
      try {
        await processUrl(runId, url);
        fetched += 1;
        parsed += 1;
      } catch (error) {
        failed += 1;
        console.error(JSON.stringify({ provider: PROVIDER, url, error: error instanceof Error ? error.message : String(error) }));
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    await completeImportRun(prisma, runId, { status: failed ? "PARTIAL" : "COMPLETED", discovered: urls.length, fetched, parsed, failed });
    console.log(JSON.stringify({ runId, discovered: urls.length, selected: selected.length, fetched, parsed, failed }, null, 2));
  } catch (error) {
    await completeImportRun(prisma, runId, { status: "FAILED", discovered: urls.length, fetched, parsed, failed, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
