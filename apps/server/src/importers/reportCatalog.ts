import { prisma } from "../db/prisma";
import { dailyEligibleWhere } from "../games/freestylerDaily";

async function main() {
  const [total, published, candidates, withBirthYear, fmsConfirmed, publishedWithBirthYear, withCompetitiveEvidence, dailyEligible, demEvidence, quintoEvidence, openIssues, candidatesReadyForReview] = await Promise.all([
    prisma.freestyler.count(),
    prisma.freestyler.count({ where: { catalogStatus: "PUBLISHED" } }),
    prisma.freestyler.count({ where: { catalogStatus: "CANDIDATE" } }),
    prisma.freestyler.count({ where: { birthYear: { not: null } } }),
    prisma.freestyler.count({ where: { fmsParticipant: true } }),
    prisma.freestyler.count({ where: { catalogStatus: "PUBLISHED", birthYear: { not: null } } }),
    prisma.freestyler.count({ where: dailyEligibleWhere }),
    prisma.freestyler.findMany({
      where: dailyEligibleWhere,
      select: { _count: { select: { sources: true } } },
    }),
    prisma.freestyler.count({
      where: { participations: { some: { competition: { slug: "dem-battles" } } } },
    }),
    prisma.freestyler.count({
      where: { participations: { some: { competition: { slug: "el-quinto-escalon" } } } },
    }),
    prisma.dataReviewIssue.count({ where: { status: "OPEN" } }),
    prisma.freestyler.findMany({
      where: {
        catalogStatus: "CANDIDATE",
        birthYear: { not: null },
        sources: { some: {} },
      },
      select: {
        alias: true,
        birthYear: true,
        fmsParticipant: true,
        country: { select: { code: true } },
        _count: {
          select: {
            sources: true,
            participations: {
              where: { competition: { slug: { in: ["dem-battles", "el-quinto-escalon"] } } },
            },
          },
        },
      },
      orderBy: { alias: "asc" },
      take: 100,
    }),
  ]);

  console.log(JSON.stringify({
    total,
    published,
    candidates,
    withBirthYear,
    fmsConfirmed,
    publishedWithBirthYear,
    withCompetitiveEvidence,
    dailyEligible: dailyEligible.filter((profile) => profile._count.sources >= 2).length,
    missingCompetitiveEvidence: publishedWithBirthYear - withCompetitiveEvidence,
    demEvidence,
    quintoEvidence,
    openIssues,
    candidatesReadyForReview,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
