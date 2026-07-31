import { prisma } from "../db/prisma";

async function main() {
  const resolved = await prisma.$executeRaw`
    UPDATE external_profiles ep
    SET linked_freestyler_id = f.id, updated_at = NOW()
    FROM freestylers f
    JOIN countries c ON c.id = f.country_id
    WHERE ep.normalized_alias = f.normalized_alias
      AND ep.country_code = c.code
      AND (ep.birth_year IS NULL OR f.birth_year IS NULL OR ep.birth_year = f.birth_year)
      AND ep.linked_freestyler_id IS DISTINCT FROM f.id
  `;

  const ambiguous = await prisma.$queryRaw<Array<{ normalized_alias: string; candidates: number }>>`
    SELECT ep.normalized_alias, COUNT(DISTINCT ep.id)::int AS candidates
    FROM external_profiles ep
    WHERE ep.linked_freestyler_id IS NULL
      AND EXISTS (
        SELECT 1 FROM freestylers f WHERE f.normalized_alias = ep.normalized_alias
      )
    GROUP BY ep.normalized_alias
    HAVING COUNT(DISTINCT ep.id) > 1
    ORDER BY ep.normalized_alias
  `;

  console.log(JSON.stringify({ resolved: Number(resolved), ambiguousExactAliases: ambiguous.length }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
