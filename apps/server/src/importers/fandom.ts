import type { PrismaClient } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";

const FANDOM_API = "https://rap.fandom.com/es/api.php";

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

interface FandomPage {
  title: string;
  missing?: boolean;
  revisions?: Array<{ slots?: { main?: { content?: string } } }>;
}

export interface ParsedFandomProfile {
  realName?: string;
  origin?: string;
  aliases: string[];
  birthDate?: Date;
  birthYear?: number;
  activityYearCandidate?: number;
  titleCandidates: string[];
}

export interface FandomImportResult {
  requested: number;
  found: number;
  updated: number;
  missing: string[];
  conflicts: number;
  titleCandidates: number;
}

export function isPlausibleBirthYear(year: number, currentYear = new Date().getUTCFullYear()): boolean {
  return year >= 1950 && year <= currentYear - 12;
}

function cleanWikitext(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/'{2,}/g, "")
    .replace(/<center>|<\/center>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function infoboxFields(wikitext: string): Record<string, string> {
  const start = wikitext.search(/\{\{Infobox(?:_|\s+)Artista/i);
  if (start === -1) return {};

  const fields: Record<string, string> = {};
  let depth = 0;
  let end = wikitext.length;

  for (let index = start; index < wikitext.length - 1; index += 1) {
    const pair = wikitext.slice(index, index + 2);
    if (pair === "{{") {
      depth += 1;
      index += 1;
    } else if (pair === "}}") {
      depth -= 1;
      index += 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  const content = wikitext.slice(start + 2, end - 1);
  const parts: string[] = [];
  let partStart = 0;
  depth = 0;

  for (let index = 0; index < content.length; index += 1) {
    const pair = content.slice(index, index + 2);
    if (pair === "{{" || pair === "[[") {
      depth += 1;
      index += 1;
    } else if ((pair === "}}" || pair === "]]") && depth > 0) {
      depth -= 1;
      index += 1;
    } else if (content[index] === "|" && depth === 0) {
      parts.push(content.slice(partStart, index));
      partStart = index + 1;
    }
  }
  parts.push(content.slice(partStart));

  for (const part of parts.slice(1)) {
    const field = /^\s*([^=|]+?)\s*=\s*([\s\S]*)$/.exec(part);
    if (!field) continue;
    fields[field[1].trim().toLowerCase()] = field[2].trim();
  }

  return fields;
}

function parseBirth(value: string | undefined): { birthDate?: Date; birthYear?: number } {
  if (!value) return {};
  const cleaned = cleanWikitext(value).toLowerCase();
  const fullDate = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/.exec(cleaned);

  if (fullDate) {
    const month = MONTHS[fullDate[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
    if (month) {
      const date = new Date(Date.UTC(Number(fullDate[3]), month - 1, Number(fullDate[1])));
      if (date.getUTCMonth() === month - 1 && date.getUTCDate() === Number(fullDate[1])) {
        return { birthDate: date, birthYear: Number(fullDate[3]) };
      }
    }
  }

  const year = /\b(19\d{2}|20\d{2})\b/.exec(cleaned);
  return year ? { birthYear: Number(year[1]) } : {};
}

function parseDebutYear(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /\b(19\d{2}|20\d{2})\b/.exec(cleanWikitext(value));
  const year = match ? Number(match[1]) : undefined;
  return year && year <= new Date().getUTCFullYear() ? year : undefined;
}

function parseTitleCandidates(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(/\r?\n/)
    .map(cleanWikitext)
    .filter((line) => /\b(FMS|Red Bull)\b/i.test(line))
    .map((line) => line.replace(/^\*+\s*/, "").split(/[|}]/, 1)[0].replace(/^\[+|\]+$/g, "").trim())
    .filter(Boolean)
    .filter((line) => line.length <= 100)
    .filter((line, index, all) => all.indexOf(line) === index);
}

function parseAliases(value: string | undefined, primaryAlias: string): string[] {
  if (!value) return [];
  const primary = normalizeAlias(primaryAlias);
  return cleanWikitext(value)
    .split(/[,/;]|\by\b/iu)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length >= 2 && alias.length <= 80)
    .filter((alias, index, all) => normalizeAlias(alias) !== primary && all.indexOf(alias) === index);
}

export function parseFandomProfile(wikitext: string, primaryAlias = ""): ParsedFandomProfile {
  const fields = infoboxFields(wikitext);
  const birth = parseBirth(fields.nacimiento);

  return {
    realName: cleanWikitext(fields["nombre real"] ?? fields.nombre_real ?? "") || undefined,
    origin: cleanWikitext(fields.origen ?? "") || undefined,
    aliases: parseAliases(fields.apodo ?? fields.aka, primaryAlias),
    ...birth,
    activityYearCandidate: parseDebutYear(fields.actividad),
    titleCandidates: parseTitleCandidates(fields.premios),
  };
}

async function fetchFandomPage(alias: string): Promise<FandomPage | null> {
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

  const body = (await response.json()) as { query?: { pages?: FandomPage[] } };
  const page = body.query?.pages?.[0];
  return page && !page.missing ? page : null;
}

export async function importFandomProfiles(prisma: PrismaClient): Promise<FandomImportResult> {
  const freestylers = await prisma.freestyler.findMany({
    select: { id: true, alias: true, realName: true, birthDate: true, birthYear: true, catalogStatus: true },
    orderBy: { alias: "asc" },
  });
  const result: FandomImportResult = {
    requested: freestylers.length,
    found: 0,
    updated: 0,
    missing: [],
    conflicts: 0,
    titleCandidates: 0,
  };

  for (const freestyler of freestylers) {
    const page = await fetchFandomPage(freestyler.alias);
    if (!page) {
      result.missing.push(freestyler.alias);
      continue;
    }

    result.found += 1;
    const wikitext = page.revisions?.[0]?.slots?.main?.content ?? "";
    const parsed = parseFandomProfile(wikitext, freestyler.alias);
    const pageUrl = `https://rap.fandom.com/es/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
    const conflicts: Record<string, { stored: string | number; fandom: string | number }> = {};
    const invalidBirthYear = Boolean(
      (parsed.birthYear && !isPlausibleBirthYear(parsed.birthYear)) ||
      (freestyler.catalogStatus === "CANDIDATE" && freestyler.birthYear && !isPlausibleBirthYear(freestyler.birthYear)),
    );

    if (invalidBirthYear) {
      await prisma.dataReviewIssue.upsert({
        where: { freestylerId_key: { freestylerId: freestyler.id, key: "fandom-birth-year-invalid" } },
        update: {
          summary: "El año de nacimiento de Wiki Rap no es plausible",
          details: { candidate: parsed.birthYear ?? freestyler.birthYear, source: pageUrl },
          status: "OPEN",
        },
        create: {
          freestylerId: freestyler.id,
          key: "fandom-birth-year-invalid",
          summary: "El año de nacimiento de Wiki Rap no es plausible",
          details: { candidate: parsed.birthYear ?? freestyler.birthYear, source: pageUrl },
        },
      });
    }

    if (
      parsed.realName &&
      freestyler.realName &&
      parsed.realName.trim().toLowerCase() !== freestyler.realName.trim().toLowerCase()
    ) {
      conflicts.realName = { stored: freestyler.realName, fandom: parsed.realName };
    }
    if (parsed.birthDate && freestyler.birthDate && parsed.birthDate.getTime() !== freestyler.birthDate.getTime()) {
      conflicts.birthDate = {
        stored: freestyler.birthDate.toISOString().slice(0, 10),
        fandom: parsed.birthDate.toISOString().slice(0, 10),
      };
    }
    if (Object.keys(conflicts).length > 0) {
      result.conflicts += 1;
      await prisma.dataReviewIssue.upsert({
        where: { freestylerId_key: { freestylerId: freestyler.id, key: "fandom-profile-conflict" } },
        update: { summary: "Wiki Rap difiere de los datos almacenados", details: { conflicts, source: pageUrl }, status: "OPEN" },
        create: {
          freestylerId: freestyler.id,
          key: "fandom-profile-conflict",
          summary: "Wiki Rap difiere de los datos almacenados",
          details: { conflicts, source: pageUrl },
        },
      });
    }

    if (parsed.activityYearCandidate) {
      await prisma.dataReviewIssue.upsert({
        where: { freestylerId_key: { freestylerId: freestyler.id, key: "fandom-activity-year-candidate" } },
        update: {
          summary: "El inicio de actividad de Wiki Rap no confirma un debut competitivo",
          details: { candidate: parsed.activityYearCandidate, source: pageUrl },
          status: "OPEN",
        },
        create: {
          freestylerId: freestyler.id,
          key: "fandom-activity-year-candidate",
          summary: "El inicio de actividad de Wiki Rap no confirma un debut competitivo",
          details: { candidate: parsed.activityYearCandidate, source: pageUrl },
        },
      });
    }

    if (parsed.titleCandidates.length > 0) {
      result.titleCandidates += parsed.titleCandidates.length;
      await prisma.dataReviewIssue.upsert({
        where: { freestylerId_key: { freestylerId: freestyler.id, key: "fandom-title-candidates" } },
        update: {
          summary: "Títulos de Wiki Rap pendientes de validación oficial",
          details: { candidates: parsed.titleCandidates, source: pageUrl },
          status: "OPEN",
        },
        create: {
          freestylerId: freestyler.id,
          key: "fandom-title-candidates",
          summary: "Títulos de Wiki Rap pendientes de validación oficial",
          details: { candidates: parsed.titleCandidates, source: pageUrl },
        },
      });
    }

    const source = await prisma.dataSource.upsert({
      where: { url: pageUrl },
      update: { name: `Wiki Rap: ${page.title}`, accessedAt: new Date() },
      create: { name: `Wiki Rap: ${page.title}`, url: pageUrl, accessedAt: new Date() },
    });

    await prisma.freestyler.update({
      where: { id: freestyler.id },
      data: {
        realName: freestyler.realName ? undefined : parsed.realName,
        birthDate: invalidBirthYear && freestyler.catalogStatus === "CANDIDATE"
          ? null
          : freestyler.birthDate ? undefined : parsed.birthDate,
        birthYear: invalidBirthYear && freestyler.catalogStatus === "CANDIDATE"
          ? null
          : freestyler.birthYear || conflicts.birthDate ? undefined : parsed.birthYear,
        sources: {
          connectOrCreate: {
            where: { freestylerId_sourceId: { freestylerId: freestyler.id, sourceId: source.id } },
            create: { sourceId: source.id },
          },
        },
      },
    });
    if (parsed.aliases.length) {
      await prisma.freestylerAlias.createMany({
        data: parsed.aliases.map((alias) => ({
          freestylerId: freestyler.id,
          alias,
          normalizedAlias: normalizeAlias(alias),
          sourceId: source.id,
        })),
        skipDuplicates: true,
      });
    }
    result.updated += 1;
  }

  return result;
}
