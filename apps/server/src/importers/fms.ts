import type { PrismaClient } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";

const FMS_API = "https://fms.tv/wp-json/wp/v2/mcs";

interface FmsProfile {
  slug: string;
  link: string;
  title?: { rendered?: string };
  acf?: {
    birth_date?: string;
    league?: string[];
    instagram?: string;
    fms_season_count?: string;
  };
}

export interface FmsImportResult {
  fetched: number;
  matched: number;
  updated: number;
  conflicts: number;
}

export function parseFmsDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return date;
}

function profileAlias(profile: FmsProfile): string {
  return (profile.title?.rendered ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

async function fetchFmsProfiles(): Promise<FmsProfile[]> {
  const profiles: FmsProfile[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(FMS_API);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("_fields", "slug,link,title,acf");

    const response = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
    if (!response.ok) throw new Error(`FMS respondió ${response.status} en la página ${page}`);

    const batch = (await response.json()) as FmsProfile[];
    profiles.push(...batch);
    totalPages = Number(response.headers.get("x-wp-totalpages") ?? "1");
    page += 1;
  } while (page <= totalPages);

  return profiles;
}

export async function importFmsProfiles(prisma: PrismaClient): Promise<FmsImportResult> {
  const profiles = await fetchFmsProfiles();
  const localProfiles = await prisma.freestyler.findMany({
    select: { id: true, normalizedAlias: true, birthDate: true, birthYear: true, aliases: { select: { normalizedAlias: true } } },
  });
  const localByAlias = new Map<string, typeof localProfiles[number]>();
  for (const profile of localProfiles) {
    localByAlias.set(profile.normalizedAlias, profile);
    for (const alias of profile.aliases) localByAlias.set(alias.normalizedAlias, profile);
  }
  const result: FmsImportResult = { fetched: profiles.length, matched: 0, updated: 0, conflicts: 0 };

  for (const profile of profiles) {
    const alias = normalizeAlias(profileAlias(profile));
    const local = localByAlias.get(alias);
    if (!local) continue;
    result.matched += 1;

    const apiBirthDate = parseFmsDate(profile.acf?.birth_date);
    const hasBirthConflict = Boolean(
      apiBirthDate && local.birthDate && apiBirthDate.getTime() !== local.birthDate.getTime(),
    );

    if (hasBirthConflict) {
      result.conflicts += 1;
      await prisma.dataReviewIssue.upsert({
        where: { freestylerId_key: { freestylerId: local.id, key: "fms-birth-date-conflict" } },
        update: {
          summary: "La fecha de FMS difiere de la fecha almacenada",
          details: {
            stored: local.birthDate?.toISOString().slice(0, 10),
            fms: apiBirthDate?.toISOString().slice(0, 10),
            source: profile.link,
          },
          status: "OPEN",
        },
        create: {
          freestylerId: local.id,
          key: "fms-birth-date-conflict",
          summary: "La fecha de FMS difiere de la fecha almacenada",
          details: {
            stored: local.birthDate?.toISOString().slice(0, 10),
            fms: apiBirthDate?.toISOString().slice(0, 10),
            source: profile.link,
          },
        },
      });
    }

    const source = await prisma.dataSource.upsert({
      where: { url: profile.link },
      update: { name: `Perfil oficial FMS: ${profileAlias(profile)}`, accessedAt: new Date() },
      create: { name: `Perfil oficial FMS: ${profileAlias(profile)}`, url: profile.link, accessedAt: new Date() },
    });

    await prisma.freestyler.update({
      where: { id: local.id },
      data: {
        birthDate: !local.birthDate && apiBirthDate ? apiBirthDate : undefined,
        birthYear: !local.birthDate && !local.birthYear && !hasBirthConflict && apiBirthDate
          ? apiBirthDate.getUTCFullYear()
          : undefined,
        fmsParticipant: true,
        instagramUrl: profile.acf?.instagram || undefined,
        sources: {
          connectOrCreate: {
            where: { freestylerId_sourceId: { freestylerId: local.id, sourceId: source.id } },
            create: { sourceId: source.id },
          },
        },
      },
    });
    result.updated += 1;
  }

  return result;
}
