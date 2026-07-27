import { prisma } from "../db/prisma";
import { discoverFandomProfiles } from "./discoverFandom";
import { importFandomProfiles } from "./fandom";
import { importFmsProfiles } from "./fms";
import { importFreestyleStatsProfiles } from "./freestyleStats";
import { promoteMatchedTitles, publishCatalogCandidates } from "./promoteCatalog";
import { validateCatalog } from "./validateCatalog";

async function main() {
  console.log(JSON.stringify({
    discover: await discoverFandomProfiles(prisma),
    fms: await importFmsProfiles(prisma),
    fandom: await importFandomProfiles(prisma),
    freestyleStats: await importFreestyleStatsProfiles(prisma),
    titles: await promoteMatchedTitles(prisma),
    profiles: await publishCatalogCandidates(prisma),
    validation: await validateCatalog(prisma),
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
