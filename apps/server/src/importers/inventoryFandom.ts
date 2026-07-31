import { normalizeAlias } from "../catalog/normalizeAlias";
import { prisma } from "../db/prisma";
import { parseFandomProfile } from "./fandom";
import {
  completeImportRun,
  createImportRun,
  replaceExternalAliases,
  replaceExternalParticipations,
  replaceExternalWins,
  upsertExternalProfile,
  type ExternalWinInput,
} from "./inventoryPersistence";
import { classifyWin, countryCodeFromText, yearFromText } from "./inventoryShared";

const PROVIDER = "fandom";
const FANDOM_API = "https://rap.fandom.com/es/api.php";

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

function countryCodeFromCategories(categories: string[]) {
  const normalized = categories.map(normalizeAlias).join(" ");
  return countryCodeFromText(normalized);
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
    const body = await response.json() as { continue?: { cmcontinue?: string }; query?: { categorymembers?: CategoryMember[] } };
    members.push(...(body.query?.categorymembers ?? []));
    continuation = body.continue?.cmcontinue;
  } while (continuation);
  return members;
}

async function fetchPages(members: CategoryMember[]) {
  const pages: CategoryPage[] = [];
  for (let offset = 0; offset < members.length; offset += 40) {
    const batch = members.slice(offset, offset + 40);
    let continuation: string | undefined;
    const pageMap = new Map<number, CategoryPage>();
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
      if (!response.ok) throw new Error(`Fandom respondió ${response.status} al consultar páginas`);
      const body = await response.json() as { continue?: { clcontinue?: string }; query?: { pages?: CategoryPage[] } };
      for (const page of body.query?.pages ?? []) {
        const previous = pageMap.get(page.pageid);
        pageMap.set(page.pageid, {
          ...page,
          categories: [...(previous?.categories ?? []), ...(page.categories ?? [])],
          revisions: page.revisions ?? previous?.revisions,
        });
      }
      continuation = body.continue?.clcontinue;
    } while (continuation);
    pages.push(...pageMap.values());
  }
  return pages;
}

function winsFromTitles(titles: string[], sourceUrl: string): ExternalWinInput[] {
  return titles.map((label) => {
    const competitionName = /fms/i.test(label) ? "Freestyle Master Series" : /red bull/i.test(label) ? "Red Bull Batalla" : label;
    return {
      competitionName,
      label,
      year: yearFromText(label),
      ...classifyWin(label),
      sourceUrl,
    };
  });
}

async function main() {
  const members = await fetchCategoryMembers();
  const limit = Number.parseInt(process.env.FANDOM_PROFILE_LIMIT ?? "0", 10) || members.length;
  const selected = members.slice(0, limit);
  const runId = await createImportRun(prisma, PROVIDER, "profile-inventory", { category: "Categoría:Freestylers", totalProfiles: members.length, limit: selected.length });
  let fetched = 0;
  let parsed = 0;
  let failed = 0;

  try {
    const pages = await fetchPages(selected);
    fetched = pages.length;
    for (const page of pages) {
      try {
        const wikitext = page.revisions?.[0]?.slots?.main?.content ?? "";
        const parsedProfile = parseFandomProfile(wikitext, page.title);
        const sourceUrl = `https://rap.fandom.com/es/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
        const countryCode = countryCodeFromCategories(page.categories?.map((category) => category.title) ?? []) ?? countryCodeFromText(parsedProfile.origin ?? "");
        const wins = winsFromTitles(parsedProfile.titleCandidates, sourceUrl);
        const externalProfileId = await upsertExternalProfile(prisma, {
          provider: PROVIDER,
          externalId: String(page.pageid),
          canonicalUrl: sourceUrl,
          sourceAlias: page.title,
          countryCode,
          realName: parsedProfile.realName ?? null,
          birthDate: parsedProfile.birthDate ?? null,
          birthYear: parsedProfile.birthYear ?? null,
          payload: {
            pageid: page.pageid,
            title: page.title,
            origin: parsedProfile.origin,
            activityYearCandidate: parsedProfile.activityYearCandidate,
            titleCandidates: parsedProfile.titleCandidates,
            categories: page.categories?.map((category) => category.title) ?? [],
          },
          runId,
        });
        await replaceExternalAliases(prisma, externalProfileId, [page.title, ...parsedProfile.aliases]);
        await replaceExternalParticipations(prisma, externalProfileId, []);
        await replaceExternalWins(prisma, externalProfileId, wins);
        parsed += 1;
      } catch (error) {
        failed += 1;
        console.error(JSON.stringify({ provider: PROVIDER, pageid: page.pageid, title: page.title, error: error instanceof Error ? error.message : String(error) }));
      }
    }
    await completeImportRun(prisma, runId, { status: failed ? "PARTIAL" : "COMPLETED", discovered: members.length, fetched, parsed, failed });
    console.log(JSON.stringify({ runId, discovered: members.length, selected: selected.length, fetched, parsed, failed }, null, 2));
  } catch (error) {
    await completeImportRun(prisma, runId, { status: "FAILED", discovered: members.length, fetched, parsed, failed, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
