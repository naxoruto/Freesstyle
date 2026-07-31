import { prisma } from "../db/prisma";
import { mapExternalParticipationCompetition, type CompetitionRef } from "../inventory/participationMapping";

type ExternalParticipationRow = {
  external_participation_id: string;
  freestyler_id: string;
  competition_name: string;
  normalized_competition: string;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const competitions = new Map(
    (await prisma.competition.findMany({ select: { id: true, slug: true, name: true } }))
      .map((competition) => [competition.slug, competition]),
  );
  const existingParticipations = new Set(
    (await prisma.participation.findMany({ select: { freestylerId: true, competitionId: true, seasonId: true } }))
      .map((participation) => `${participation.freestylerId}:${participation.competitionId}:${participation.seasonId ?? ""}`),
  );
  const rows = await prisma.$queryRaw<ExternalParticipationRow[]>`
    SELECT xp.id AS external_participation_id, ep.linked_freestyler_id AS freestyler_id, xp.competition_name, xp.normalized_competition
    FROM external_participations xp
    INNER JOIN external_profiles ep ON ep.id = xp.external_profile_id
    WHERE ep.linked_freestyler_id IS NOT NULL
    ORDER BY xp.competition_name ASC
  `;

  const toCreate = new Map<string, { freestylerId: string; competitionId: string; slug: string }>();
  let mappedExternalParticipations = 0;
  let skippedUnmapped = 0;

  for (const row of rows) {
    const slug = mapExternalParticipationCompetition(row.normalized_competition, competitions);
    if (!slug) {
      skippedUnmapped += 1;
      continue;
    }
    const competition = competitions.get(slug);
    if (!competition) {
      skippedUnmapped += 1;
      continue;
    }
    mappedExternalParticipations += 1;
    const key = `${row.freestyler_id}:${competition.id}:`;
    if (!existingParticipations.has(key)) {
      toCreate.set(key, { freestylerId: row.freestyler_id, competitionId: competition.id, slug });
    }
  }

  const bySlug = new Map<string, number>();
  for (const item of toCreate.values()) bySlug.set(item.slug, (bySlug.get(item.slug) ?? 0) + 1);

  let created = 0;
  let fmsFlagsUpdated = 0;
  let redBullInternationalFlagsUpdated = 0;

  if (!dryRun) {
    for (const item of toCreate.values()) {
      const exists = await prisma.participation.findFirst({
        where: { freestylerId: item.freestylerId, competitionId: item.competitionId, seasonId: null },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.participation.create({ data: { freestylerId: item.freestylerId, competitionId: item.competitionId } });
      created += 1;
    }

    const fms = competitions.get("fms");
    if (fms) {
      const result = await prisma.freestyler.updateMany({
        where: { fmsParticipant: { not: true }, participations: { some: { competitionId: fms.id } } },
        data: { fmsParticipant: true },
      });
      fmsFlagsUpdated = result.count;
    }

    const redBullInternationalFreestylerIds = await prisma.$queryRaw<Array<{ freestyler_id: string }>>`
      SELECT DISTINCT ep.linked_freestyler_id AS freestyler_id
      FROM external_participations xp
      INNER JOIN external_profiles ep ON ep.id = xp.external_profile_id
      WHERE ep.linked_freestyler_id IS NOT NULL
        AND xp.normalized_competition LIKE 'red bull batalla internacional%'
    `;
    if (redBullInternationalFreestylerIds.length) {
      const result = await prisma.freestyler.updateMany({
        where: {
          id: { in: redBullInternationalFreestylerIds.map((row) => row.freestyler_id) },
          redBullInternational: { not: true },
        },
        data: { redBullInternational: true },
      });
      redBullInternationalFlagsUpdated = result.count;
    }
  }

  console.log(JSON.stringify({
    dryRun,
    externalParticipations: rows.length,
    mappedExternalParticipations,
    skippedUnmapped,
    newParticipations: dryRun ? toCreate.size : created,
    fmsFlagsUpdated,
    redBullInternationalFlagsUpdated,
    newParticipationsByCompetition: Object.fromEntries([...bySlug.entries()].sort(([left], [right]) => left.localeCompare(right))),
  }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
