import { prisma } from "../db/prisma";
import { importFandomProfiles } from "./fandom";
import { importFmsProfiles } from "./fms";

async function main() {
  const fms = await importFmsProfiles(prisma);
  console.log("FMS:", JSON.stringify(fms));

  const fandom = await importFandomProfiles(prisma);
  console.log("Wiki Rap/Fandom:", JSON.stringify(fandom));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
