import type { Prisma } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { prisma } from "../db/prisma";

const REVIEW_KEY = "eligible-competition-review";
const MANUAL_EXCLUSIONS = new Set(["nicki nicole"]);

function hasCompetitiveEvidence(details: Prisma.JsonValue | null) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return false;
  const value = details as Record<string, Prisma.JsonValue>;
  const sources = value.sources;
  const assessment = value.assessment;
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return false;
  if (!assessment || typeof assessment !== "object" || Array.isArray(assessment)) return false;
  const sourceData = sources as Record<string, Prisma.JsonValue>;
  const assessmentData = assessment as Record<string, Prisma.JsonValue>;
  const fandom = sourceData.fandom;
  const stats = sourceData.freestyleStats;
  const participations = assessmentData.participations;
  const titles = assessmentData.titles;
  return Boolean(
    fandom && typeof fandom === "object" && !Array.isArray(fandom) && (fandom as Record<string, Prisma.JsonValue>).found === true &&
    stats && typeof stats === "object" && !Array.isArray(stats) && (stats as Record<string, Prisma.JsonValue>).found === true &&
    ((Array.isArray(participations) && participations.length > 0) || (Array.isArray(titles) && titles.length > 0)),
  );
}

function readDetails(details: Prisma.JsonValue | null) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = details as Record<string, Prisma.JsonValue>;
  const sources = value.sources;
  const assessment = value.assessment;
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return null;
  if (!assessment || typeof assessment !== "object" || Array.isArray(assessment)) return null;
  const sourceData = sources as Record<string, Prisma.JsonValue>;
  const assessmentData = assessment as Record<string, Prisma.JsonValue>;
  const statsSource = sourceData.freestyleStats;
  const statsUrl = statsSource && typeof statsSource === "object" && !Array.isArray(statsSource)
    ? (statsSource as Record<string, Prisma.JsonValue>).url
    : null;
  const participations = Array.isArray(assessmentData.participations)
    ? assessmentData.participations.filter((item): item is string => typeof item === "string")
    : [];
  const titles = Array.isArray(assessmentData.titles)
    ? assessmentData.titles.filter((item): item is string => typeof item === "string")
    : [];
  return { statsUrl: typeof statsUrl === "string" ? statsUrl : null, participations, titles };
}

function competitionData(label: string) {
  const slug = normalizeAlias(label).replace(/\s+/g, "-");
  if (slug.startsWith("fms")) return { slug: "fms", name: "Freestyle Master Series", organizer: "Urban Roosters" };
  if (slug.startsWith("red-bull") || slug.includes("batalla-de-los-gallos")) {
    return { slug: "red-bull-batalla", name: "Red Bull Batalla", organizer: "Red Bull" };
  }
  return { slug, name: label, organizer: "Freestyle Stats" };
}

async function main() {
  const candidates = await prisma.freestyler.findMany({
    where: { catalogStatus: "CANDIDATE", birthYear: { not: null } },
    select: {
      id: true,
      alias: true,
      normalizedAlias: true,
      reviewIssues: { where: { key: REVIEW_KEY }, select: { details: true } },
    },
  });
  const publishCandidates = candidates
    .filter((candidate) => !MANUAL_EXCLUSIONS.has(candidate.normalizedAlias))
    .filter((candidate) => hasCompetitiveEvidence(candidate.reviewIssues[0]?.details ?? null))
    .map((candidate) => ({ candidate, details: readDetails(candidate.reviewIssues[0]?.details ?? null) }))
    .filter((item): item is { candidate: typeof candidates[number]; details: NonNullable<ReturnType<typeof readDetails>> } => Boolean(item.details));

  for (const { candidate, details } of publishCandidates) {
    const source = details.statsUrl
      ? await prisma.dataSource.findUnique({ where: { url: details.statsUrl }, select: { id: true } })
      : null;
    for (const label of details.participations) {
      const data = competitionData(label);
      const competition = await prisma.competition.upsert({ where: { slug: data.slug }, update: {}, create: data });
      const exists = await prisma.participation.findFirst({ where: { freestylerId: candidate.id, competitionId: competition.id, seasonId: null }, select: { id: true } });
      if (!exists) await prisma.participation.create({ data: { freestylerId: candidate.id, competitionId: competition.id } });
    }
    if (!details.participations.length && source) {
      for (const label of details.titles) {
        const data = competitionData(label);
        const competition = await prisma.competition.upsert({ where: { slug: data.slug }, update: {}, create: data });
        const exists = await prisma.title.findFirst({ where: { freestylerId: candidate.id, competitionId: competition.id, label }, select: { id: true } });
        if (!exists) await prisma.title.create({ data: { freestylerId: candidate.id, competitionId: competition.id, label, sourceId: source.id } });
      }
    }
  }

  const publishIds = publishCandidates.map(({ candidate }) => candidate.id);
  const published = await prisma.freestyler.updateMany({
    where: { id: { in: publishIds }, catalogStatus: "CANDIDATE" },
    data: { catalogStatus: "PUBLISHED", verifiedAt: new Date() },
  });
  console.log(JSON.stringify({ candidates: candidates.length, eligibleForPromotion: publishIds.length, published: published.count }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
