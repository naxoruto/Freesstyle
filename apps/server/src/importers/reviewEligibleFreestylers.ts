import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { prisma } from "../db/prisma";
import { dailyEligibleWhere } from "../games/freestylerDaily";
import { parseFandomProfile } from "./fandom";
import { freestyleStatsSlug, parseFreestyleStatsProfile } from "./freestyleStats";
import { firstBooleanEvidence, SOURCE_PRIORITY } from "./sourcePriority";

const FANDOM_API = "https://rap.fandom.com/es/api.php";
const STATS_BASE_URL = "https://freestylestats.com";
const REVIEW_KEY = "eligible-competition-review";

const reviewableWhere = {
  OR: [
    dailyEligibleWhere,
    { catalogStatus: "CANDIDATE", birthYear: { not: null }, sources: { some: {} } },
  ],
} satisfies Prisma.FreestylerWhereInput;

type SourceResult = {
  url?: string;
  found: boolean;
  fmsEvidence: boolean;
  redBullEvidence: boolean;
  participations: string[];
  titles: string[];
};

type FandomPage = {
  title: string;
  missing?: boolean;
  revisions?: Array<{ slots?: { main?: { content?: string } } }>;
};

async function fetchFandom(alias: string): Promise<SourceResult> {
  const url = new URL(FANDOM_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", alias);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  const response = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
  if (!response.ok) throw new Error(`Fandom respondió ${response.status} para ${alias}`);
  const body = await response.json() as { query?: { pages?: FandomPage[] } };
  const page = body.query?.pages?.[0];
  if (!page || page.missing) return { found: false, fmsEvidence: false, redBullEvidence: false, participations: [], titles: [] };

  const wikitext = page.revisions?.[0]?.slots?.main?.content ?? "";
  const parsed = parseFandomProfile(wikitext, alias);
  return {
    url: `https://rap.fandom.com/es/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    found: true,
    fmsEvidence: /\b(?:FMS|Freestyle Master Series)\b/i.test(wikitext),
    redBullEvidence: /\b(?:Red Bull|Batalla de los Gallos)[^\n]{0,80}\bInternacional\b/i.test(wikitext),
    participations: [],
    titles: parsed.titleCandidates,
  };
}

async function fetchFreestyleStats(aliases: string[]): Promise<SourceResult> {
  for (const alias of [aliases[0], ...aliases.slice(1)]) {
    const url = `${STATS_BASE_URL}/profile/${encodeURIComponent(freestyleStatsSlug(alias))}`;
    const response = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
    if (!response.ok) continue;
    const parsed = parseFreestyleStatsProfile(await response.text());
    const participations = parsed.competitionCandidates;
    return {
      url,
      found: true,
      fmsEvidence: participations.some((item) => /\b(?:FMS|Freestyle Master Series)\b/i.test(item)),
      redBullEvidence: participations.some((item) => /\b(?:Red Bull|Batalla de los Gallos)[^\n]{0,80}\bInternacional\b/i.test(item)),
      participations,
      titles: parsed.titleCandidates.map((item) => item.competitionName),
    };
  }
  return { found: false, fmsEvidence: false, redBullEvidence: false, participations: [], titles: [] };
}

function unique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export async function reviewEligibleFreestylers(prismaClient: PrismaClient = prisma) {
  const profiles = await prismaClient.freestyler.findMany({
    where: reviewableWhere,
    select: {
      id: true,
      alias: true,
      fmsParticipant: true,
      redBullInternational: true,
      aliases: { select: { alias: true } },
      participations: { select: { competition: { select: { slug: true, name: true } }, season: { select: { name: true } } } },
      titles: { select: { label: true, competition: { select: { slug: true, name: true } } } },
    },
    orderBy: { alias: "asc" },
  });
  const result = { requested: profiles.length, reviewed: 0, fandomFound: 0, freestyleStatsFound: 0, issuesUpserted: 0 };

  for (const profile of profiles) {
    const aliases = [profile.alias, ...profile.aliases.map((item) => item.alias)];
    const [fandom, freestyleStats] = await Promise.all([fetchFandom(profile.alias), fetchFreestyleStats(aliases)]);
    if (fandom.found) result.fandomFound += 1;
    if (freestyleStats.found) result.freestyleStatsFound += 1;

    const sources = [fandom.url, freestyleStats.url].filter((url): url is string => Boolean(url));
    for (const url of sources) {
      const source = await prismaClient.dataSource.upsert({
        where: { url },
        update: { accessedAt: new Date() },
        create: { name: url.includes("fandom.com") ? `Wiki Rap: ${profile.alias}` : `Freestyle Stats: ${profile.alias}`, url, accessedAt: new Date() },
      });
      await prismaClient.freestylerSource.createMany({ data: { freestylerId: profile.id, sourceId: source.id }, skipDuplicates: true });
    }

    const fms = firstBooleanEvidence([
      { source: "fandom", value: fandom.found && fandom.fmsEvidence ? true : undefined },
      { source: "freestyle-stats", value: freestyleStats.found && freestyleStats.fmsEvidence ? true : undefined },
      { source: "fms-redbull", value: profile.fmsParticipant ?? undefined },
    ]);
    const redBull = firstBooleanEvidence([
      { source: "fandom", value: fandom.found && fandom.redBullEvidence ? true : undefined },
      { source: "freestyle-stats", value: freestyleStats.found && freestyleStats.redBullEvidence ? true : undefined },
      { source: "fms-redbull", value: profile.redBullInternational ?? undefined },
    ]);

    const details = {
      sourcePriority: SOURCE_PRIORITY,
      sources: { fandom, freestyleStats },
      stored: {
        fmsParticipant: profile.fmsParticipant,
        redBullInternational: profile.redBullInternational,
        participations: profile.participations.map((item) => ({ competition: item.competition.slug, name: item.competition.name, season: item.season?.name ?? null })),
        titles: profile.titles.map((item) => ({ competition: item.competition.slug, name: item.competition.name, label: item.label })),
      },
      assessment: {
        fms: { fandom: fandom.fmsEvidence, freestyleStats: freestyleStats.fmsEvidence },
        redBull: { fandom: fandom.redBullEvidence, freestyleStats: freestyleStats.redBullEvidence },
        participations: unique(freestyleStats.participations),
        titles: unique([...fandom.titles, ...freestyleStats.titles]),
      },
      resolvedByPriority: {
        fms: fandom.fmsEvidence ? "fandom" : freestyleStats.fmsEvidence ? "freestyle-stats" : "fms-redbull",
        redBull: fandom.redBullEvidence ? "fandom" : freestyleStats.redBullEvidence ? "freestyle-stats" : "fms-redbull",
        participations: freestyleStats.participations.length ? "freestyle-stats" : "fms-redbull",
        titles: fandom.titles.length ? "fandom" : freestyleStats.titles.length ? "freestyle-stats" : "fms-redbull",
      },
      precedenceValues: { fms: fms?.value ?? null, redBull: redBull?.value ?? null },
    } satisfies Prisma.InputJsonValue;

    await prismaClient.dataReviewIssue.upsert({
      where: { freestylerId_key: { freestylerId: profile.id, key: REVIEW_KEY } },
      update: { summary: "Revisión con precedencia Fandom > Freestyle Stats > FMS/Red Bull", details, status: "OPEN" },
      create: { freestylerId: profile.id, key: REVIEW_KEY, summary: "Revisión con precedencia Fandom > Freestyle Stats > FMS/Red Bull", details },
    });
    result.reviewed += 1;
    result.issuesUpserted += 1;
  }

  return result;
}

if (require.main === module) {
  reviewEligibleFreestylers()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(async () => { await prisma.$disconnect(); });
}
