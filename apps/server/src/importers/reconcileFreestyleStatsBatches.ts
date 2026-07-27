import { prisma } from "../db/prisma";
import { reconcileFreestyleStats } from "./reconcileFreestyleStats";

const batches = Math.min(Math.max(Number.parseInt(process.env.FREESTYLE_STATS_RECONCILE_BATCHES ?? "10", 10) || 10, 1), 100);
const limit = Math.min(Math.max(Number.parseInt(process.env.FREESTYLE_STATS_RECONCILE_LIMIT ?? "50", 10) || 50, 1), 500);
const delayMs = Math.max(Number.parseInt(process.env.FREESTYLE_STATS_RECONCILE_DELAY_MS ?? "1000", 10) || 1_000, 250);

async function main() {
  const results = [];
  for (let index = 0; index < batches; index += 1) {
    const result = await reconcileFreestyleStats(prisma, limit);
    results.push(result);
    if (!result.scannedBattles) break;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const summary = results.reduce((total, result) => ({
    scannedBattles: total.scannedBattles + result.scannedBattles,
    candidatesCreated: total.candidatesCreated + result.candidatesCreated,
    akaSuggestions: total.akaSuggestions + result.akaSuggestions,
    unresolved: total.unresolved + result.unresolved,
  }), { scannedBattles: 0, candidatesCreated: 0, akaSuggestions: 0, unresolved: 0 });
  console.log(JSON.stringify({ batches: results.length, ...summary }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
