import { prisma } from "../db/prisma";
import { importFreestyleStatsProfiles } from "./freestyleStats";

async function main() {
  console.log(JSON.stringify(await importFreestyleStatsProfiles(prisma), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
