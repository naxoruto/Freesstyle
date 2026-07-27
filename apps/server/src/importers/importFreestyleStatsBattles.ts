import { prisma } from "../db/prisma";
import { importFreestyleStatsBattles } from "./freestyleStatsBattles";

const limit = Number.parseInt(process.env.FREESTYLE_STATS_BATTLE_LIMIT ?? "100", 10);

importFreestyleStatsBattles(prisma, Number.isFinite(limit) ? Math.max(1, limit) : 100)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
