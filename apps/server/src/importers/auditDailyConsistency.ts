import { normalizeAlias } from "../catalog/normalizeAlias";
import { prisma } from "../db/prisma";
import { titleFingerprint } from "./validateCatalog";

const NON_MAJOR_TITLE = /sub campe|regional|semifinal|exhibici|ultima oportunidad|5 vidas|plaza|fallo organizativo/;

async function main() {
  const rows = await prisma.dataReviewIssue.findMany({
    where: { key: "eligible-competition-review", freestyler: { catalogStatus: "PUBLISHED" } },
    select: {
      freestyler: {
        select: {
          alias: true,
          fmsParticipant: true,
          redBullInternational: true,
          participations: { select: { competition: { select: { slug: true } } } },
          titles: { select: { label: true } },
        },
      },
      details: true,
    },
    orderBy: { freestyler: { alias: "asc" } },
  });
  const missingFmsParticipation: string[] = [];
  const missingRedBullInternational: string[] = [];
  const missingMajorTitles: Array<{ alias: string; titles: string[] }> = [];

  for (const row of rows) {
    const details = row.details as Record<string, any>;
    const statsParticipations = details?.sources?.freestyleStats?.participations ?? [];
    const fandomTitles: string[] = details?.sources?.fandom?.titles ?? [];
    const participationSlugs = new Set(row.freestyler.participations.map((item) => item.competition.slug));
    const storedFingerprints = new Set(
      row.freestyler.titles.map((title) => titleFingerprint(title.label ?? "")).filter(Boolean),
    );

    if (
      statsParticipations.some((label: string) => /^FMS\b/i.test(label)) &&
      (!row.freestyler.fmsParticipant || !participationSlugs.has("fms"))
    ) {
      missingFmsParticipation.push(row.freestyler.alias);
    }
    if (
      statsParticipations.some((label: string) => /Red Bull.*Internacional/i.test(label)) &&
      (!row.freestyler.redBullInternational || !participationSlugs.has("red-bull-batalla"))
    ) {
      missingRedBullInternational.push(row.freestyler.alias);
    }

    const missingTitles = fandomTitles
      .filter((label) => !NON_MAJOR_TITLE.test(normalizeAlias(label)))
      .map((label) => ({ label, fingerprint: titleFingerprint(label) }))
      .filter((title) => title.fingerprint && !storedFingerprints.has(title.fingerprint))
      .map((title) => title.label);
    if (missingTitles.length) missingMajorTitles.push({ alias: row.freestyler.alias, titles: missingTitles });
  }

  console.log(JSON.stringify({
    reviewed: rows.length,
    missingFmsParticipation: { count: missingFmsParticipation.length, aliases: missingFmsParticipation },
    missingRedBullInternational: { count: missingRedBullInternational.length, aliases: missingRedBullInternational },
    missingMajorTitles: { count: missingMajorTitles.length, profiles: missingMajorTitles },
  }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
