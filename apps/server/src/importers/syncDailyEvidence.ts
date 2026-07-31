import type { Prisma } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { prisma } from "../db/prisma";
import { titleFingerprint } from "./validateCatalog";

const REVIEW_KEY = "eligible-competition-review";
const NON_MAJOR_TITLE = /sub campe|regional|semifinal|exhibici|ultima oportunidad|5 vidas|plaza|fallo organizativo/;

function yearFromLabel(label: string) {
  const year = /\b(19\d{2}|20\d{2})\b/.exec(label)?.[1];
  return year ? new Date(`${year}-01-01T00:00:00.000Z`) : undefined;
}

async function ensureParticipation(freestylerId: string, competitionId: string) {
  const existing = await prisma.participation.findFirst({
    where: { freestylerId, competitionId, seasonId: null },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.participation.create({ data: { freestylerId, competitionId } });
  return true;
}

async function main() {
  const [fms, redBull, rows] = await Promise.all([
    prisma.competition.upsert({
      where: { slug: "fms" },
      update: {},
      create: { slug: "fms", name: "Freestyle Master Series", organizer: "Urban Roosters" },
    }),
    prisma.competition.upsert({
      where: { slug: "red-bull-batalla" },
      update: {},
      create: { slug: "red-bull-batalla", name: "Red Bull Batalla", organizer: "Red Bull" },
    }),
    prisma.dataReviewIssue.findMany({
      where: { key: REVIEW_KEY, freestyler: { catalogStatus: "PUBLISHED" } },
      select: {
        id: true,
        details: true,
        freestyler: { select: { id: true, alias: true, titles: { select: { label: true } } } },
      },
    }),
  ]);
  const result = {
    reviewed: rows.length,
    fmsProfilesUpdated: 0,
    redBullProfilesUpdated: 0,
    participationsCreated: 0,
    titlesCreated: 0,
  };

  for (const row of rows) {
    const details = row.details as Record<string, any>;
    const statsParticipations: string[] = details?.sources?.freestyleStats?.participations ?? [];
    const fandom = details?.sources?.fandom;
    const fandomTitles: string[] = fandom?.titles ?? [];
    const precedenceValues = details?.precedenceValues ?? {};
    const hasFms = precedenceValues.fms === true || statsParticipations.some((label) => /^FMS\b/i.test(label));
    const hasRedBullInternational = precedenceValues.redBull === true || statsParticipations.some((label) => /Red Bull.*Internacional/i.test(label));

    if (hasFms) {
      await prisma.freestyler.update({ where: { id: row.freestyler.id }, data: { fmsParticipant: true } });
      if (await ensureParticipation(row.freestyler.id, fms.id)) result.participationsCreated += 1;
      result.fmsProfilesUpdated += 1;
    }
    if (hasRedBullInternational) {
      await prisma.freestyler.update({ where: { id: row.freestyler.id }, data: { redBullInternational: true } });
      if (await ensureParticipation(row.freestyler.id, redBull.id)) result.participationsCreated += 1;
      result.redBullProfilesUpdated += 1;
    }

    if (fandom?.url) {
      const source = await prisma.dataSource.upsert({
        where: { url: fandom.url },
        update: { accessedAt: new Date() },
        create: { name: `Wiki Rap: ${row.freestyler.alias}`, url: fandom.url, accessedAt: new Date() },
      });
      const storedFingerprints = new Set(
        row.freestyler.titles.map((title) => titleFingerprint(title.label ?? "")).filter(Boolean),
      );
      for (const label of fandomTitles) {
        if (NON_MAJOR_TITLE.test(normalizeAlias(label))) continue;
        const fingerprint = titleFingerprint(label);
        if (!fingerprint || storedFingerprints.has(fingerprint)) continue;
        const competitionId = fingerprint.startsWith("fms:") ? fms.id : redBull.id;
        await prisma.title.create({
          data: {
            freestylerId: row.freestyler.id,
            competitionId,
            label,
            wonAt: yearFromLabel(label),
            sourceId: source.id,
          },
        });
        storedFingerprints.add(fingerprint);
        result.titlesCreated += 1;
      }
    }

    await prisma.dataReviewIssue.update({ where: { id: row.id }, data: { status: "RESOLVED" } });
  }

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
