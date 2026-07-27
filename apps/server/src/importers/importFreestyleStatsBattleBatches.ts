import { prisma } from "../db/prisma";
import { importFreestyleStatsBattles } from "./freestyleStatsBattles";

const batches = Number.parseInt(process.env.FREESTYLE_STATS_BATTLE_BATCHES ?? "10", 10);
const limit = Number.parseInt(process.env.FREESTYLE_STATS_BATTLE_LIMIT ?? "100", 10);
const delayMs = Number.parseInt(process.env.FREESTYLE_STATS_BATTLE_DELAY_MS ?? "1000", 10);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const safeBatches = Number.isFinite(batches) ? Math.min(Math.max(batches, 1), 500) : 10;
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 1_000) : 100;
  const safeDelay = Number.isFinite(delayMs) ? Math.max(delayMs, 250) : 1_000;
  const results = [];

  for (let index = 0; index < safeBatches; index += 1) {
    const result = await importFreestyleStatsBattles(prisma, safeLimit);
    results.push(result);
    if (!result.scanned || result.remaining <= 0) break;
    await wait(safeDelay);
  }

  const summary = results.reduce((total, result) => ({
    scanned: total.scanned + result.scanned,
    imported: total.imported + result.imported,
    unmatched: total.unmatched + result.unmatched,
    remaining: result.remaining,
  }), { scanned: 0, imported: 0, unmatched: 0, remaining: 0 });
  console.log(JSON.stringify({ batches: results.length, ...summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
