import { prisma } from "../db/prisma";
import { importPlazaCircuits } from "./demBattles";

async function main() {
  console.log(JSON.stringify(await importPlazaCircuits(prisma), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
