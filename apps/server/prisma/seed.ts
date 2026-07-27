import { PrismaClient } from "@prisma/client";
import { normalizeAlias } from "../src/catalog/normalizeAlias";
import { countries, freestylers } from "../src/importers/catalogSeedData";

const prisma = new PrismaClient();

async function main() {
  const countryIds = new Map<string, string>();

  for (const country of countries) {
    const record = await prisma.country.upsert({
      where: { code: country.code },
      update: { name: country.name, flagEmoji: country.flagEmoji },
      create: country,
    });
    countryIds.set(country.code, record.id);
  }

  await prisma.competition.upsert({
    where: { slug: "fms" },
    update: { name: "Freestyle Master Series", organizer: "Urban Roosters" },
    create: { slug: "fms", name: "Freestyle Master Series", organizer: "Urban Roosters" },
  });
  await prisma.competition.upsert({
    where: { slug: "red-bull-batalla" },
    update: { name: "Red Bull Batalla", organizer: "Red Bull", international: true },
    create: { slug: "red-bull-batalla", name: "Red Bull Batalla", organizer: "Red Bull", international: true },
  });

  const accessedAt = new Date("2026-07-27T00:00:00.000Z");
  const fmsSource = await prisma.dataSource.upsert({
    where: { url: "https://fms.tv/mcs/" },
    update: { name: "Directorio oficial de MCs de FMS", accessedAt },
    create: { name: "Directorio oficial de MCs de FMS", url: "https://fms.tv/mcs/", accessedAt },
  });
  const redBullSource = await prisma.dataSource.upsert({
    where: { url: "https://www.redbull.com/int-es/collections/batalla-artistas" },
    update: { name: "Directorio oficial de artistas de Red Bull Batalla", accessedAt },
    create: {
      name: "Directorio oficial de artistas de Red Bull Batalla",
      url: "https://www.redbull.com/int-es/collections/batalla-artistas",
      accessedAt,
    },
  });

  for (const entry of freestylers) {
    const countryId = countryIds.get(entry.countryCode);
    if (!countryId) throw new Error(`País no encontrado: ${entry.countryCode}`);

    const freestyler = await prisma.freestyler.upsert({
      where: { slug: entry.slug },
      update: {
        alias: entry.alias,
        normalizedAlias: normalizeAlias(entry.alias),
        countryId,
        catalogStatus: "PUBLISHED",
        verifiedAt: accessedAt,
      },
      create: {
        slug: entry.slug,
        alias: entry.alias,
        normalizedAlias: normalizeAlias(entry.alias),
        countryId,
        catalogStatus: "PUBLISHED",
        verifiedAt: accessedAt,
        sources: {
          create: [{ sourceId: fmsSource.id }, { sourceId: redBullSource.id }],
        },
      },
    });

    await prisma.freestylerSource.createMany({
      data: [fmsSource.id, redBullSource.id].map((sourceId) => ({ freestylerId: freestyler.id, sourceId })),
      skipDuplicates: true,
    });
  }

  console.log(`Catálogo inicial cargado: ${freestylers.length} freestylers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
