import { normalizeAlias } from "../catalog/normalizeAlias";
import { prisma } from "../db/prisma";
import { countryCodeFromCategories, countryCodeFromOrigin } from "./discoverFandom";
import { isPlausibleBirthYear, parseFandomProfile } from "./fandom";

const FANDOM_API = "https://rap.fandom.com/es/api.php";
const MANUAL_EXCLUSIONS = new Set(["nicki nicole"]);

interface CategoryMember {
  pageid: number;
  title: string;
}

interface EvaluationRow {
  alias: string;
  country: string;
  decision: "YA_PUBLICADO" | "AGREGAR_DIARIO" | "AGREGAR_CATALOGO" | "REVISAR" | "EXCLUIR";
  reason: string;
  birthYear?: number;
  titleCandidates: number;
}

async function fetchJson(url: URL) {
  const response = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
  if (!response.ok) throw new Error(`Fandom respondió ${response.status}`);
  return response.json() as Promise<any>;
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

    const body = await fetchJson(url);
    members.push(...(body.query?.categorymembers ?? []));
    continuation = body.continue?.cmcontinue;
  } while (continuation);

  return members;
}

function hasFreestyleSignal(wikitext: string): boolean {
  return /\[\[Categoría:Freestylers\]\]|\bfreestyler\b|\bfreestyle\b|batallas? de (?:rap|gallos)/i.test(wikitext);
}

function hasMajorSignal(wikitext: string, titleCandidates: string[]): boolean {
  return titleCandidates.length > 0 || /\b(FMS|Freestyle Master Series|Red Bull Batalla|Batalla de los Gallos|Red Bull Nacional|Red Bull Internacional)\b/i.test(wikitext);
}

function evaluate(row: Omit<EvaluationRow, "decision" | "reason"> & {
  published: boolean;
  freestyleSignal: boolean;
  majorSignal: boolean;
}) {
  const normalized = normalizeAlias(row.alias);
  if (row.published) return { decision: "YA_PUBLICADO", reason: "ya publicado" } as const;
  if (MANUAL_EXCLUSIONS.has(normalized)) return { decision: "EXCLUIR", reason: "exclusión manual: artista sin perfil competitivo de freestyle" } as const;
  if (!row.freestyleSignal) return { decision: "EXCLUIR", reason: "sin señal suficiente de freestyle" } as const;
  if (!row.country) return { decision: "REVISAR", reason: "falta país detectable" } as const;
  if (row.birthYear && row.majorSignal) return { decision: "AGREGAR_DIARIO", reason: "país, nacimiento y evidencia competitiva" } as const;
  return { decision: "AGREGAR_CATALOGO", reason: "freestyler publicable, no elegible para diario todavía" } as const;
}

async function main() {
  const published = new Set(
    (await prisma.freestyler.findMany({ where: { catalogStatus: "PUBLISHED" }, select: { alias: true } }))
      .map((freestyler) => normalizeAlias(freestyler.alias)),
  );
  const members = await fetchCategoryMembers();
  const rows: EvaluationRow[] = [];

  for (let offset = 0; offset < members.length; offset += 40) {
    const batch = members.slice(offset, offset + 40);
    const url = new URL(FANDOM_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "categories|revisions");
    url.searchParams.set("pageids", batch.map((member) => member.pageid).join("|"));
    url.searchParams.set("cllimit", "max");
    url.searchParams.set("rvprop", "content");
    url.searchParams.set("rvslots", "main");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");

    const body = await fetchJson(url);
    for (const page of body.query?.pages ?? []) {
      const wikitext = page.revisions?.[0]?.slots?.main?.content ?? "";
      const parsed = parseFandomProfile(wikitext);
      const categories = (page.categories ?? []).map((category: { title: string }) => category.title);
      const country = countryCodeFromCategories(categories) ?? countryCodeFromOrigin(parsed.origin) ?? "";
      const birthYear = parsed.birthYear && isPlausibleBirthYear(parsed.birthYear) ? parsed.birthYear : undefined;
      const classification = evaluate({
        alias: page.title,
        country,
        birthYear,
        titleCandidates: parsed.titleCandidates.length,
        published: published.has(normalizeAlias(page.title)),
        freestyleSignal: hasFreestyleSignal(wikitext),
        majorSignal: hasMajorSignal(wikitext, parsed.titleCandidates),
      });

      rows.push({
        alias: page.title,
        country,
        birthYear,
        titleCandidates: parsed.titleCandidates.length,
        ...classification,
      });
    }
  }

  rows.sort((a, b) => a.alias.localeCompare(b.alias, "es"));
  const groups = ["YA_PUBLICADO", "AGREGAR_DIARIO", "AGREGAR_CATALOGO", "REVISAR", "EXCLUIR"] as const;
  for (const group of groups) {
    const groupRows = rows.filter((row) => row.decision === group);
    console.log(`\n## ${group} (${groupRows.length})`);
    for (const row of groupRows) {
      const facts = [row.country, row.birthYear ? `nac. ${row.birthYear}` : "", row.titleCandidates ? `${row.titleCandidates} títulos` : ""]
        .filter(Boolean)
        .join("; ");
      console.log(`- ${row.alias}${facts ? ` (${facts})` : ""}: ${row.reason}`);
    }
  }
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
