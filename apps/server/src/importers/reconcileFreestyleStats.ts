import { prisma } from "../db/prisma";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { candidateSlug } from "./discoverFandom";
import { freestyleStatsSlug } from "./freestyleStats";
import { parseFreestyleStatsBattle } from "./freestyleStatsBattles";

const SOURCE = "freestyle-stats";
const BATTLE_SOURCE = "freestyle-stats-battle";
const COUNTRY_CODES: Array<[RegExp, string, string]> = [
  [/\bargentina\b/i, "AR", "Argentina"], [/\bchile\b/i, "CL", "Chile"], [/\bcolombia\b/i, "CO", "Colombia"],
  [/\bm[eé]xico\b/i, "MX", "México"], [/\bespa[nñ]a\b/i, "ES", "España"], [/\bper[uú]\b/i, "PE", "Perú"],
  [/\bvenezuela\b/i, "VE", "Venezuela"], [/\brep[uú]blica dominicana\b/i, "DO", "República Dominicana"],
  [/\buruguay\b/i, "UY", "Uruguay"], [/\bpanam[aá]\b/i, "PA", "Panamá"], [/\bcosta rica\b/i, "CR", "Costa Rica"],
  [/\bguatemala\b/i, "GT", "Guatemala"], [/\bpuerto rico\b/i, "PR", "Puerto Rico"], [/\bbolivia\b/i, "BO", "Bolivia"],
  [/\becuador\b/i, "EC", "Ecuador"], [/\bparaguay\b/i, "PY", "Paraguay"], [/\bel salvador\b/i, "SV", "El Salvador"],
  [/\bhonduras\b/i, "HN", "Honduras"], [/\bcuba\b/i, "CU", "Cuba"], [/\bestados unidos\b/i, "US", "Estados Unidos"],
];

function distance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function countryFromProfile(text: string) {
  return COUNTRY_CODES.find(([pattern]) => pattern.test(text));
}

function likelyAliasVariant(candidate: string, existing: string): boolean {
  if (candidate.length < 4 || existing.length < 4) return false;
  return distance(candidate, existing) <= 1 || candidate.startsWith(existing) || existing.startsWith(candidate);
}

async function profileCountry(alias: string) {
  const url = `https://freestylestats.com/profile/${encodeURIComponent(freestyleStatsSlug(alias))}`;
  const response = await fetch(url, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
  if (!response.ok) return { profileUrl: url };
  const text = (await response.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const country = countryFromProfile(text);
  return { profileUrl: url, countryCode: country?.[1], countryName: country?.[2] };
}

export async function reconcileFreestyleStats(prismaClient = prisma, limit = 50) {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const records = await prismaClient.importRecord.findMany({ where: { source: BATTLE_SOURCE, status: "UNMATCHED" }, orderBy: { createdAt: "asc" }, take: safeLimit });
  const profiles = await prismaClient.freestyler.findMany({ select: { id: true, alias: true, normalizedAlias: true, country: { select: { code: true } }, aliases: { select: { normalizedAlias: true } } } });
  const aliases = profiles.flatMap((profile) => [
    { alias: profile.alias, normalizedAlias: profile.normalizedAlias, countryCode: profile.country.code },
    ...profile.aliases.map((item) => ({ alias: profile.alias, normalizedAlias: item.normalizedAlias, countryCode: profile.country.code })),
  ]);
  let created = 0;
  let suggested = 0;
  let unresolved = 0;

  for (const record of records) {
    const externalId = record.key.replace(`${BATTLE_SOURCE}:`, "");
    const response = await fetch(`https://freestylestats.com/battle/${externalId}`, { headers: { "User-Agent": "FreestyleArenaCatalog/1.0" } });
    if (!response.ok) continue;
    const battle = parseFreestyleStatsBattle(await response.text());
    if (!battle) continue;
    for (const alias of [battle.competitor1, battle.competitor2]) {
      const normalized = normalizeAlias(alias);
      if (aliases.some((item) => item.normalizedAlias === normalized)) continue;
      const profile = await profileCountry(alias);
      const nearest = aliases
        .filter((item) => !profile.countryCode || item.countryCode === profile.countryCode)
        .map((item) => ({ alias: item.alias, value: distance(normalized, item.normalizedAlias) }))
        .filter((item) => likelyAliasVariant(normalized, normalizeAlias(item.alias)))
        .sort((left, right) => left.value - right.value)[0];
      const suggestion = nearest?.alias;
      await prismaClient.externalProfileCandidate.upsert({
        where: { source_normalizedAlias: { source: SOURCE, normalizedAlias: normalized } },
        update: { alias, profileUrl: profile.profileUrl, countryCode: profile.countryCode, suggestedAlias: suggestion },
        create: { source: SOURCE, alias, normalizedAlias: normalized, profileUrl: profile.profileUrl, countryCode: profile.countryCode, suggestedAlias: suggestion },
      });
      if (suggestion) {
        suggested += 1;
        continue;
      }
      if (!profile.countryCode || !profile.countryName) {
        unresolved += 1;
        continue;
      }
      const country = await prismaClient.country.upsert({ where: { code: profile.countryCode }, update: { name: profile.countryName }, create: { code: profile.countryCode, name: profile.countryName } });
      const source = await prismaClient.dataSource.upsert({ where: { url: profile.profileUrl }, update: { name: `Freestyle Stats: ${alias}`, accessedAt: new Date() }, create: { name: `Freestyle Stats: ${alias}`, url: profile.profileUrl, accessedAt: new Date() } });
      const slug = candidateSlug(alias, Number.parseInt(externalId.slice(-6), 16));
      const existing = await prismaClient.freestyler.findUnique({ where: { normalizedAlias: normalized }, select: { id: true } });
      if (existing) continue;
      for (let suffix = 0; suffix < 100; suffix += 1) {
        const uniqueSlug = suffix ? `${slug}-${externalId}-${suffix}` : slug;
        const occupied = await prismaClient.freestyler.findUnique({ where: { slug: uniqueSlug }, select: { id: true } });
        if (occupied) continue;
        try {
          await prismaClient.freestyler.create({
            data: { alias, normalizedAlias: normalized, slug: uniqueSlug, countryId: country.id, sources: { create: { sourceId: source.id } } },
          });
          created += 1;
          break;
        } catch (error) {
          if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") throw error;
        }
      }
    }
    await prismaClient.importRecord.update({ where: { key: record.key }, data: { status: "RECONCILED" } });
  }
  return { scannedBattles: records.length, candidatesCreated: created, akaSuggestions: suggested, unresolved };
}

async function main() {
  const limit = Number.parseInt(process.env.FREESTYLE_STATS_RECONCILE_LIMIT ?? "50", 10) || 50;
  console.log(JSON.stringify(await reconcileFreestyleStats(prisma, limit), null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(async () => { await prisma.$disconnect(); });
}
