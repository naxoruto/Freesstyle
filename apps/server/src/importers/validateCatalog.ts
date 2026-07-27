import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { VERIFIED_PROFILES, VERIFIED_SOURCES } from "./verifiedCatalog";
import { STYLE_SOURCE, STYLE_TAGS, VERIFIED_STYLES } from "./verifiedStyles";

const COUNTRIES = ["argentina", "espana", "mexico", "chile", "peru", "colombia"];

interface CandidateDetails {
  source?: string;
  candidates?: string[];
}

export function titleFingerprint(label: string): string | null {
  const normalized = normalizeAlias(label);
  const competition = normalized.includes("fms")
    ? "fms"
    : normalized.includes("red bull")
      ? "red-bull-batalla"
      : null;
  if (!competition) return null;

  const year = normalized.match(/\b(19\d{2}|20\d{2})\b/)?.[1];
  if (!year) return null;

  let scope = COUNTRIES.find((country) => normalized.includes(country));
  if (normalized.includes("world series")) scope = "world-series";
  else if (normalized.includes("internacional")) scope = "internacional";
  if (!scope) return null;

  return `${competition}:${scope}:${year}`;
}

export function readCandidateDetails(value: Prisma.JsonValue | null): CandidateDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const details = value as Record<string, Prisma.JsonValue>;
  const directCandidates = Array.isArray(details.candidates)
    ? details.candidates.filter((candidate): candidate is string => typeof candidate === "string")
    : [];
  const confirmed = Array.isArray(details.confirmed)
    ? details.confirmed.filter((candidate): candidate is string => typeof candidate === "string")
    : [];
  const pending = Array.isArray(details.pending)
    ? details.pending.filter((candidate): candidate is string => typeof candidate === "string")
    : [];

  return {
    source: typeof details.source === "string" ? details.source : undefined,
    candidates: directCandidates.length ? directCandidates : [...confirmed, ...pending],
  };
}

export interface CatalogValidationResult {
  profiles: number;
  titlesCreated: number;
  candidatesConfirmed: number;
  candidatesPending: number;
  stylesAssigned: number;
  missingProfiles: string[];
}

export async function validateCatalog(prismaClient: PrismaClient): Promise<CatalogValidationResult> {
  const result: CatalogValidationResult = {
    profiles: 0,
    titlesCreated: 0,
    candidatesConfirmed: 0,
    candidatesPending: 0,
    stylesAssigned: 0,
    missingProfiles: [],
  };
  const competitions = new Map(
    (await prismaClient.competition.findMany({ select: { id: true, slug: true } }))
      .map((competition) => [competition.slug, competition.id]),
  );
  const sourceIds = new Map<string, string>();
  const styleTagIds = new Map<string, string>();

  for (const [slug, sourceData] of Object.entries(VERIFIED_SOURCES)) {
    const source = await prismaClient.dataSource.upsert({
      where: { url: sourceData.url },
      update: { name: sourceData.name, accessedAt: new Date() },
      create: { ...sourceData, accessedAt: new Date() },
    });
    sourceIds.set(slug, source.id);
  }

  const styleSource = await prismaClient.dataSource.upsert({
    where: { url: STYLE_SOURCE.url },
    update: { name: STYLE_SOURCE.name, accessedAt: new Date() },
    create: { ...STYLE_SOURCE, accessedAt: new Date() },
  });
  for (const styleData of STYLE_TAGS) {
    const style = await prismaClient.styleTag.upsert({
      where: { slug: styleData.slug },
      update: { name: styleData.name, description: styleData.description },
      create: styleData,
    });
    styleTagIds.set(style.slug, style.id);
  }

  for (const verified of VERIFIED_PROFILES) {
    const freestyler = await prismaClient.freestyler.findUnique({
      where: { normalizedAlias: normalizeAlias(verified.alias) },
      select: { id: true },
    });
    if (!freestyler) {
      result.missingProfiles.push(verified.alias);
      continue;
    }

    result.profiles += 1;
    const fmsParticipant = verified.fmsParticipant ?? true;
    await prismaClient.freestyler.update({
      where: { id: freestyler.id },
      data: {
        catalogStatus: "PUBLISHED",
        fmsParticipant,
        redBullInternational: verified.redBullInternational,
        realName: verified.realName,
        birthYear: verified.birthYear,
        ...(verified.clearBirthDate ? { birthDate: null } : {}),
        verifiedAt: new Date(),
      },
    });

    for (const sourceData of verified.sources ?? []) {
      const source = await prismaClient.dataSource.upsert({
        where: { url: sourceData.url },
        update: { name: sourceData.name, accessedAt: new Date() },
        create: { ...sourceData, accessedAt: new Date() },
      });
      await prismaClient.freestylerSource.createMany({
        data: { freestylerId: freestyler.id, sourceId: source.id },
        skipDuplicates: true,
      });
    }

    const styles = VERIFIED_STYLES[verified.alias] ?? [];
    await prismaClient.freestylerStyle.deleteMany({ where: { freestylerId: freestyler.id } });
    for (const [index, styleSlug] of styles.entries()) {
      const styleTagId = styleTagIds.get(styleSlug);
      if (!styleTagId) continue;
      await prismaClient.freestylerStyle.create({
        data: {
          freestylerId: freestyler.id,
          styleTagId,
          rank: index + 1,
          sourceId: styleSource.id,
        },
      });
      result.stylesAssigned += 1;
    }

    const fmsCompetitionId = competitions.get("fms");
    if (fmsCompetitionId && fmsParticipant) {
      const participation = await prismaClient.participation.findFirst({
        where: { freestylerId: freestyler.id, competitionId: fmsCompetitionId, seasonId: null },
        select: { id: true },
      });
      if (!participation) {
        await prismaClient.participation.create({
          data: { freestylerId: freestyler.id, competitionId: fmsCompetitionId },
        });
      }
    }

    for (const [competitionSlug, label] of verified.titles) {
      const competitionId = competitions.get(competitionSlug);
      const sourceId = sourceIds.get(competitionSlug);
      if (!competitionId || !sourceId) continue;

      const existing = await prismaClient.title.findFirst({
        where: { freestylerId: freestyler.id, competitionId, label },
        select: { id: true },
      });
      if (existing) {
        await prismaClient.title.update({ where: { id: existing.id }, data: { sourceId } });
      } else {
        await prismaClient.title.create({
          data: { freestylerId: freestyler.id, competitionId, label, sourceId },
        });
        result.titlesCreated += 1;
      }
    }

    const issue = await prismaClient.dataReviewIssue.findUnique({
      where: { freestylerId_key: { freestylerId: freestyler.id, key: "fandom-title-candidates" } },
      select: { details: true },
    });
    if (!issue) continue;

    const details = readCandidateDetails(issue.details);
    const verifiedFingerprints = new Set(verified.titles.map(([, label]) => titleFingerprint(label)).filter(Boolean));
    const confirmed: string[] = [];
    const pending: string[] = [];

    for (const candidate of details.candidates ?? []) {
      const fingerprint = titleFingerprint(candidate);
      if (fingerprint && verifiedFingerprints.has(fingerprint)) confirmed.push(candidate);
      else pending.push(candidate);
    }

    result.candidatesConfirmed += confirmed.length;
    result.candidatesPending += pending.length;
    await prismaClient.dataReviewIssue.update({
      where: { freestylerId_key: { freestylerId: freestyler.id, key: "fandom-title-candidates" } },
      data: {
        summary: pending.length
          ? `${confirmed.length} títulos confirmados; ${pending.length} pendientes`
          : `${confirmed.length} títulos confirmados`,
        details: {
          source: details.source,
          confirmed,
          pending,
          verifiedTitles: verified.titles.map(([, label]) => label),
        },
        status: pending.length ? "OPEN" : "RESOLVED",
      },
    });
  }

  return result;
}

async function main() {
  console.log(JSON.stringify(await validateCatalog(prisma), null, 2));
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
