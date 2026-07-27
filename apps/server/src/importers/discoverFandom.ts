import type { PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { parseFandomProfile } from "./fandom";

const FANDOM_API = "https://rap.fandom.com/es/api.php";
const TARGET_COUNTRIES: Record<string, string> = {
  argentina: "AR",
  espana: "ES",
  mexico: "MX",
  chile: "CL",
  peru: "PE",
  colombia: "CO",
  venezuela: "VE",
  "republica dominicana": "DO",
  uruguay: "UY",
  panama: "PA",
  "costa rica": "CR",
  guatemala: "GT",
  "puerto rico": "PR",
};

const COUNTRY_ALIASES: Array<[code: string, patterns: RegExp[]]> = [
  ["AR", [/\bargentina\b/i]],
  ["ES", [/\bespana\b/i, /\bespaña\b/i]],
  ["MX", [/\bmexico\b/i, /\bméxico\b/i]],
  ["CL", [/\bchile\b/i]],
  ["PE", [/\bperu\b/i, /\bperú\b/i]],
  ["CO", [/\bcolombia\b/i]],
  ["VE", [/\bvenezuela\b/i]],
  ["DO", [/\brepublica dominicana\b/i, /\brepública dominicana\b/i, /\bdominicana\b/i]],
  ["UY", [/\buruguay\b/i]],
  ["PA", [/\bpanama\b/i, /\bpanamá\b/i]],
  ["CR", [/\bcosta rica\b/i]],
  ["GT", [/\bguatemala\b/i]],
  ["PR", [/\bpuerto rico\b/i]],
];

interface CategoryMember {
  pageid: number;
  title: string;
}

interface CategoryPage {
  pageid: number;
  title: string;
  categories?: Array<{ title: string }>;
  revisions?: Array<{ slots?: { main?: { content?: string } } }>;
}

export interface DiscoveryResult {
  found: number;
  matched: number;
  discovered: number;
  outsideSupportedCountries: number;
  byCountry: Record<string, number>;
}

export function countryCodeFromCategories(categories: string[]): string | null {
  for (const category of categories) {
    const name = normalizeAlias(category.replace(/^Categoría:/i, ""));
    if (TARGET_COUNTRIES[name]) return TARGET_COUNTRIES[name];
  }
  return null;
}

export function countryCodeFromOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  for (const [code, patterns] of COUNTRY_ALIASES) {
    if (patterns.some((pattern) => pattern.test(origin))) return code;
  }
  return null;
}

export function candidateSlug(alias: string, pageId: number): string {
  const base = normalizeAlias(alias).replace(/\s+/g, "-");
  return base || `fandom-${pageId}`;
}

async function fetchCategoryMembers(): Promise<CategoryMember[]> {
  const members: CategoryMember[] = [];
  let continuation: string | undefined;

  do {
    const url = new URL(FANDOM_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "categorymembers");
    url.searchParams.set("cmtitle", "Categoría:Freestylers");
    url.searchParams.set("cmnamespace", "0");
    url.searchParams.set("cmlimit", "500");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    if (continuation) url.searchParams.set("cmcontinue", continuation);

    const response = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
    if (!response.ok) throw new Error(`Fandom respondió ${response.status} al descubrir perfiles`);
    const body = await response.json() as {
      continue?: { cmcontinue?: string };
      query?: { categorymembers?: CategoryMember[] };
    };
    members.push(...(body.query?.categorymembers ?? []));
    continuation = body.continue?.cmcontinue;
  } while (continuation);

  return members;
}

async function fetchPageFacts(members: CategoryMember[]): Promise<Map<number, { categories: string[]; wikitext: string }>> {
  const result = new Map<number, string[]>();
  const facts = new Map<number, { categories: string[]; wikitext: string }>();

  for (let offset = 0; offset < members.length; offset += 40) {
    const batch = members.slice(offset, offset + 40);
    let continuation: string | undefined;

    do {
      const url = new URL(FANDOM_API);
      url.searchParams.set("action", "query");
      url.searchParams.set("prop", "categories|revisions");
      url.searchParams.set("pageids", batch.map((member) => member.pageid).join("|"));
      url.searchParams.set("cllimit", "max");
      url.searchParams.set("rvprop", "content");
      url.searchParams.set("rvslots", "main");
      url.searchParams.set("format", "json");
      url.searchParams.set("formatversion", "2");
      if (continuation) url.searchParams.set("clcontinue", continuation);

      const response = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
      if (!response.ok) throw new Error(`Fandom respondió ${response.status} al consultar países`);
      const body = await response.json() as {
        continue?: { clcontinue?: string };
        query?: { pages?: CategoryPage[] };
      };
      for (const page of body.query?.pages ?? []) {
        const previous = result.get(page.pageid) ?? [];
        const categories = [...previous, ...(page.categories ?? []).map((category) => category.title)];
        result.set(page.pageid, categories);
        facts.set(page.pageid, {
          categories,
          wikitext: page.revisions?.[0]?.slots?.main?.content ?? facts.get(page.pageid)?.wikitext ?? "",
        });
      }
      continuation = body.continue?.clcontinue;
    } while (continuation);
  }

  return facts;
}

export async function discoverFandomProfiles(prismaClient: PrismaClient): Promise<DiscoveryResult> {
  const members = await fetchCategoryMembers();
  const pageFacts = await fetchPageFacts(members);
  const countries = new Map(
    (await prismaClient.country.findMany({ select: { id: true, code: true } }))
      .map((country) => [country.code, country.id]),
  );
  const result: DiscoveryResult = {
    found: members.length,
    matched: 0,
    discovered: 0,
    outsideSupportedCountries: 0,
    byCountry: {},
  };

  for (const member of members) {
    const normalizedAlias = normalizeAlias(member.title);
    const existing = await prismaClient.freestyler.findUnique({ where: { normalizedAlias }, select: { id: true } });
    if (existing) {
      result.matched += 1;
      continue;
    }

    const facts = pageFacts.get(member.pageid);
    const parsed = parseFandomProfile(facts?.wikitext ?? "");
    const countryCode = countryCodeFromCategories(facts?.categories ?? []) ?? countryCodeFromOrigin(parsed.origin);
    const countryId = countryCode ? countries.get(countryCode) : undefined;
    if (!countryCode || !countryId) {
      result.outsideSupportedCountries += 1;
      continue;
    }

    const sourceUrl = `https://rap.fandom.com/es/wiki/${encodeURIComponent(member.title.replace(/ /g, "_"))}`;
    const source = await prismaClient.dataSource.upsert({
      where: { url: sourceUrl },
      update: { name: `Wiki Rap: ${member.title}`, accessedAt: new Date() },
      create: { name: `Wiki Rap: ${member.title}`, url: sourceUrl, accessedAt: new Date() },
    });
    const desiredSlug = candidateSlug(member.title, member.pageid);
    const slugExists = await prismaClient.freestyler.findUnique({ where: { slug: desiredSlug }, select: { id: true } });

    await prismaClient.freestyler.create({
      data: {
        alias: member.title,
        normalizedAlias,
        slug: slugExists ? `${desiredSlug}-${member.pageid}` : desiredSlug,
        countryId,
        catalogStatus: "CANDIDATE",
        sources: { create: { sourceId: source.id } },
      },
    });
    result.discovered += 1;
    result.byCountry[countryCode] = (result.byCountry[countryCode] ?? 0) + 1;
  }

  return result;
}

async function main() {
  console.log(JSON.stringify(await discoverFandomProfiles(prisma), null, 2));
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
