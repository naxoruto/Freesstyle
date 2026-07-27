import type { PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma";
import { normalizeAlias } from "../catalog/normalizeAlias";

const FANDOM_API_URL = "https://rap.fandom.com/es/api.php";

export interface PlazaCircuitConfig {
  slug: string;
  name: string;
  pageTitle: string;
  pageUrl: string;
  countryCode: string;
  organizer: string;
  trustedShortAliases?: string[];
  sourceAliases?: Record<string, string[]>;
}

export const PLAZA_CIRCUITS: PlazaCircuitConfig[] = [
  {
    slug: "dem-battles",
    name: "DEM Battles",
    pageTitle: "DEM Battles",
    pageUrl: "https://rap.fandom.com/es/wiki/DEM_Battles",
    countryCode: "CL",
    organizer: "Diego y Matías Núñez",
  },
  {
    slug: "el-quinto-escalon",
    name: "El Quinto Escalón",
    pageTitle: "El Quinto Escalón",
    pageUrl: "https://rap.fandom.com/es/wiki/El_Quinto_Escal%C3%B3n",
    countryCode: "AR",
    organizer: "Ysy A y Muphasa",
    trustedShortAliases: ["Dam", "MKS", "MP", "Wos"],
    sourceAliases: {
      "G Sony": ["Sony"],
      "Lucho SSJ": ["Lucho"],
    },
  },
];

interface DemPageResponse {
  query?: {
    pages?: Array<{
      revisions?: Array<{ slots?: { main?: { content?: string } } }>;
    }>;
  };
}

export function isAliasMentioned(wikitext: string, alias: string, allowShort = false): boolean {
  const needle = normalizeAlias(alias);
  if (!allowShort && needle.length < 4) return false;
  return ` ${normalizeAlias(wikitext)} `.includes(` ${needle} `);
}

async function fetchCircuitWikitext(pageTitle: string): Promise<string> {
  const url = new URL(FANDOM_API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("titles", pageTitle);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  const response = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
  if (!response.ok) throw new Error(`Fandom respondió ${response.status} al consultar ${pageTitle}`);
  const body = await response.json() as DemPageResponse;
  const content = body.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
  if (!content) throw new Error(`La página de ${pageTitle} no contiene wikitext`);
  return content;
}

export interface PlazaImportResult {
  competition: string;
  scanned: number;
  matched: number;
  participationsCreated: number;
  aliases: string[];
}

export async function importPlazaCircuit(
  prismaClient: PrismaClient,
  config: PlazaCircuitConfig,
): Promise<PlazaImportResult> {
  const wikitext = await fetchCircuitWikitext(config.pageTitle);
  const competition = await prismaClient.competition.upsert({
    where: { slug: config.slug },
    update: { name: config.name, organizer: config.organizer },
    create: { slug: config.slug, name: config.name, organizer: config.organizer },
  });
  const source = await prismaClient.dataSource.upsert({
    where: { url: config.pageUrl },
    update: { name: `Wiki Rap: ${config.name}`, accessedAt: new Date() },
    create: { name: `Wiki Rap: ${config.name}`, url: config.pageUrl, accessedAt: new Date() },
  });
  const profiles = await prismaClient.freestyler.findMany({
    where: { country: { code: config.countryCode } },
    select: { id: true, alias: true },
    orderBy: { alias: "asc" },
  });
  const result: PlazaImportResult = {
    competition: config.name,
    scanned: profiles.length,
    matched: 0,
    participationsCreated: 0,
    aliases: [],
  };
  const trustedShortAliases = new Set(
    config.trustedShortAliases?.map((alias) => normalizeAlias(alias)) ?? [],
  );

  for (const profile of profiles) {
    const aliases = [profile.alias, ...(config.sourceAliases?.[profile.alias] ?? [])];
    const matched = aliases.some((alias) =>
      isAliasMentioned(wikitext, alias, trustedShortAliases.has(normalizeAlias(profile.alias))),
    );
    if (!matched) continue;
    result.matched += 1;
    result.aliases.push(profile.alias);

    const participation = await prismaClient.participation.findFirst({
      where: { freestylerId: profile.id, competitionId: competition.id, seasonId: null },
      select: { id: true },
    });
    if (!participation) {
      await prismaClient.participation.create({
        data: { freestylerId: profile.id, competitionId: competition.id },
      });
      result.participationsCreated += 1;
    }
    await prismaClient.freestylerSource.createMany({
      data: { freestylerId: profile.id, sourceId: source.id },
      skipDuplicates: true,
    });
  }

  return result;
}

export async function importDemBattles(prismaClient: PrismaClient): Promise<PlazaImportResult> {
  return importPlazaCircuit(prismaClient, PLAZA_CIRCUITS[0]);
}

export async function importPlazaCircuits(prismaClient: PrismaClient) {
  const results: PlazaImportResult[] = [];
  for (const circuit of PLAZA_CIRCUITS) {
    results.push(await importPlazaCircuit(prismaClient, circuit));
  }
  return results;
}

async function main() {
  console.log(JSON.stringify(await importDemBattles(prisma), null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
