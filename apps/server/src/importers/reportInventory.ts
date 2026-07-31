import { prisma } from "../db/prisma";

async function main() {
  const [providers, profileCoverage, exactMatches, linkedProfiles, countryConflicts, birthConflicts, recentRuns] = await Promise.all([
    prisma.$queryRaw<Array<{ provider: string; profiles: bigint; with_country: bigint; with_birth_year: bigint; with_real_name: bigint }>>`
      SELECT provider, COUNT(*) AS profiles,
        COUNT(*) FILTER (WHERE country_code IS NOT NULL) AS with_country,
        COUNT(*) FILTER (WHERE birth_year IS NOT NULL) AS with_birth_year,
        COUNT(*) FILTER (WHERE real_name IS NOT NULL) AS with_real_name
      FROM external_profiles
      GROUP BY provider
      ORDER BY provider
    `,
    prisma.$queryRaw<Array<{ provider: string; participations: bigint; wins: bigint; daily_wins: bigint }>>`
      SELECT ep.provider,
        COUNT(DISTINCT xp.id) AS participations,
        COUNT(DISTINCT ew.id) AS wins,
        COUNT(DISTINCT ew.id) FILTER (WHERE ew.counts_for_daily) AS daily_wins
      FROM external_profiles ep
      LEFT JOIN external_participations xp ON xp.external_profile_id = ep.id
      LEFT JOIN external_wins ew ON ew.external_profile_id = ep.id
      GROUP BY ep.provider
      ORDER BY ep.provider
    `,
    prisma.$queryRaw<Array<{ provider: string; exact_alias_matches: bigint }>>`
      SELECT ep.provider, COUNT(*) AS exact_alias_matches
      FROM external_profiles ep
      JOIN freestylers f ON f.normalized_alias = ep.normalized_alias
      GROUP BY ep.provider
      ORDER BY ep.provider
    `,
    prisma.$queryRaw<Array<{ provider: string; linked_profiles: bigint }>>`
      SELECT provider, COUNT(*) AS linked_profiles
      FROM external_profiles
      WHERE linked_freestyler_id IS NOT NULL
      GROUP BY provider
      ORDER BY provider
    `,
    prisma.$queryRaw<Array<{ alias: string; values: string[] }>>`
      SELECT f.alias, ARRAY_AGG(DISTINCT ep.country_code) AS values
      FROM external_profiles ep
      JOIN freestylers f ON f.id = ep.linked_freestyler_id
      WHERE ep.country_code IS NOT NULL
      GROUP BY f.id, f.alias
      HAVING COUNT(DISTINCT ep.country_code) > 1
      ORDER BY f.alias
      LIMIT 100
    `,
    prisma.$queryRaw<Array<{ alias: string; values: number[] }>>`
      SELECT f.alias, ARRAY_AGG(DISTINCT ep.birth_year) AS values
      FROM external_profiles ep
      JOIN freestylers f ON f.id = ep.linked_freestyler_id
      WHERE ep.birth_year IS NOT NULL
      GROUP BY f.id, f.alias
      HAVING COUNT(DISTINCT ep.birth_year) > 1
      ORDER BY f.alias
      LIMIT 100
    `,
    prisma.$queryRaw<Array<{ provider: string; kind: string; status: string; started_at: Date; completed_at: Date | null; discovered_count: number; parsed_count: number; failed_count: number }>>`
      SELECT provider, kind, status, started_at, completed_at, discovered_count, parsed_count, failed_count
      FROM catalog_import_runs
      ORDER BY started_at DESC
      LIMIT 10
    `,
  ]);

  const numberize = (value: unknown) => typeof value === "bigint" ? Number(value) : value;
  const convert = <T extends Record<string, unknown>>(rows: T[]) => rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, numberize(value)]),
  ));

  console.log(JSON.stringify({
    providers: convert(providers),
    profileCoverage: convert(profileCoverage),
    exactMatches: convert(exactMatches),
    linkedProfiles: convert(linkedProfiles),
    conflicts: {
      country: { countShown: countryConflicts.length, examples: countryConflicts },
      birthYear: { countShown: birthConflicts.length, examples: birthConflicts },
    },
    recentRuns,
  }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
