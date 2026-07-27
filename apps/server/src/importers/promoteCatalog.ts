import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { prisma } from "../db/prisma";

const MANUAL_EXCLUSIONS = new Set(["nicki nicole"]);

interface StatsTitleCandidate {
  competitionSlug: string;
  competitionName: string;
}

function stringCandidates(value: Prisma.JsonValue | null): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const details = value as Record<string, Prisma.JsonValue>;
  const candidates = details.candidates;
  return Array.isArray(candidates) ? candidates.filter((item): item is string => typeof item === "string") : [];
}

function statsTitleCandidates(value: Prisma.JsonValue | null): StatsTitleCandidate[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const candidates = (value as Record<string, Prisma.JsonValue>).candidates;
  if (!Array.isArray(candidates)) return [];
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const record = candidate as Record<string, Prisma.JsonValue>;
    if (typeof record.competitionSlug !== "string" || typeof record.competitionName !== "string") return [];
    return [{ competitionSlug: record.competitionSlug, competitionName: record.competitionName }];
  });
}

function canonicalCompetition(stats: StatsTitleCandidate) {
  const normalized = normalizeAlias(stats.competitionSlug);
  if (normalized.startsWith("fms")) return { slug: "fms", name: "Freestyle Master Series", organizer: "Urban Roosters" };
  if (normalized.startsWith("red-bull")) return { slug: "red-bull-batalla", name: "Red Bull Batalla", organizer: "Red Bull" };
  if (normalized.startsWith("god-level")) return { slug: "god-level", name: "God Level", organizer: "God Level" };
  return { slug: stats.competitionSlug, name: stats.competitionName, organizer: "Por verificar" };
}

function yearFromLabel(label: string): Date | undefined {
  const year = /\b(19\d{2}|20\d{2})\b/.exec(label)?.[1];
  return year ? new Date(`${year}-01-01T00:00:00.000Z`) : undefined;
}

export async function promoteMatchedTitles(prismaClient: PrismaClient) {
  const profiles = await prismaClient.freestyler.findMany({
    select: {
      id: true,
      reviewIssues: { where: { key: { in: ["fandom-title-candidates", "freestyle-stats-title-candidates"] } }, select: { key: true, details: true } },
      sources: { where: { source: { url: { startsWith: "https://freestylestats.com/profile/" } } }, select: { sourceId: true } },
    },
  });
  let created = 0;

  for (const profile of profiles) {
    const fandom = stringCandidates(profile.reviewIssues.find((issue) => issue.key === "fandom-title-candidates")?.details ?? null);
    const stats = statsTitleCandidates(profile.reviewIssues.find((issue) => issue.key === "freestyle-stats-title-candidates")?.details ?? null);
    const sourceId = profile.sources[0]?.sourceId;
    if (!sourceId) continue;

    for (const statsTitle of stats) {
      const matchingLabel = fandom.find((label) => normalizeAlias(label).includes(normalizeAlias(statsTitle.competitionName)));
      if (!matchingLabel) continue;
      const competitionData = canonicalCompetition(statsTitle);
      const competition = await prismaClient.competition.upsert({
        where: { slug: competitionData.slug },
        update: { name: competitionData.name, organizer: competitionData.organizer },
        create: competitionData,
      });
      const exists = await prismaClient.title.findFirst({
        where: { freestylerId: profile.id, competitionId: competition.id, label: matchingLabel },
        select: { id: true },
      });
      if (exists) continue;
      await prismaClient.title.create({
        data: { freestylerId: profile.id, competitionId: competition.id, label: matchingLabel, wonAt: yearFromLabel(matchingLabel), sourceId },
      });
      created += 1;
    }
  }

  return { profiles: profiles.length, titlesCreated: created };
}

export async function publishCatalogCandidates(prismaClient: PrismaClient) {
  const candidates = await prismaClient.freestyler.findMany({
    where: { catalogStatus: "CANDIDATE", sources: { some: {} } },
    select: { id: true, normalizedAlias: true },
  });
  const publishIds = candidates.filter((candidate) => !MANUAL_EXCLUSIONS.has(candidate.normalizedAlias)).map((candidate) => candidate.id);
  const [published, rejected] = await prismaClient.$transaction([
    prismaClient.freestyler.updateMany({ where: { id: { in: publishIds } }, data: { catalogStatus: "PUBLISHED", verifiedAt: new Date() } }),
    prismaClient.freestyler.updateMany({ where: { normalizedAlias: { in: [...MANUAL_EXCLUSIONS] } }, data: { catalogStatus: "REJECTED" } }),
  ]);
  return { published: published.count, rejected: rejected.count };
}

async function main() {
  console.log(JSON.stringify({
    titles: await promoteMatchedTitles(prisma),
    profiles: await publishCatalogCandidates(prisma),
  }, null, 2));
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
