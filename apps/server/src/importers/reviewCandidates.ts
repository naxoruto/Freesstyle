import type { Prisma } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { prisma } from "../db/prisma";

const MANUAL_EXCLUSIONS = new Set(["nicki nicole"]);

type ReviewGroup = "REVISAR_DIARIO" | "PUBLICAR_CATALOGO" | "COMPLETAR_DATOS" | "EXCLUIR";

function readStringArray(value: Prisma.JsonValue | null, key: string): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const candidate = (value as Record<string, Prisma.JsonValue>)[key];
  return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string") : [];
}

function titleCandidates(issues: Array<{ key: string; details: Prisma.JsonValue | null }>): string[] {
  const issue = issues.find((item) => item.key === "fandom-title-candidates");
  if (!issue) return [];
  return [
    ...readStringArray(issue.details, "candidates"),
    ...readStringArray(issue.details, "confirmed"),
    ...readStringArray(issue.details, "pending"),
  ].filter((item, index, all) => all.indexOf(item) === index);
}

function hasMajorSignal(titles: string[], fmsParticipant: boolean | null): boolean {
  return Boolean(fmsParticipant) || titles.some((title) => /\b(FMS|Red Bull|Batalla de los Gallos)\b/i.test(title));
}

function classify(candidate: {
  alias: string;
  birthYear: number | null;
  fmsParticipant: boolean | null;
  sources: number;
  titleCandidates: string[];
}): { group: ReviewGroup; reason: string } {
  if (MANUAL_EXCLUSIONS.has(normalizeAlias(candidate.alias))) {
    return { group: "EXCLUIR", reason: "exclusion manual: artista sin carrera competitiva de freestyle" };
  }
  if (candidate.birthYear && candidate.sources >= 2 && hasMajorSignal(candidate.titleCandidates, candidate.fmsParticipant)) {
    return { group: "REVISAR_DIARIO", reason: "tiene nacimiento, fuentes y señal FMS/Red Bull; faltan validación final y estilos" };
  }
  if (candidate.sources >= 1) {
    return { group: "PUBLICAR_CATALOGO", reason: "publicable para catálogo, no para Freestyler diario todavía" };
  }
  return { group: "COMPLETAR_DATOS", reason: "faltan fuentes o datos mínimos" };
}

async function main() {
  const candidates = await prisma.freestyler.findMany({
    where: { catalogStatus: "CANDIDATE" },
    select: {
      alias: true,
      birthYear: true,
      fmsParticipant: true,
      redBullInternational: true,
      country: { select: { code: true } },
      reviewIssues: { where: { status: "OPEN" }, select: { key: true, details: true } },
      _count: { select: { sources: true, styles: true, titles: true, participations: true } },
    },
    orderBy: { alias: "asc" },
  });
  const rows = candidates.map((candidate) => {
    const titles = titleCandidates(candidate.reviewIssues);
    return {
      ...candidate,
      titleCandidates: titles,
      ...classify({
        alias: candidate.alias,
        birthYear: candidate.birthYear,
        fmsParticipant: candidate.fmsParticipant,
        sources: candidate._count.sources,
        titleCandidates: titles,
      }),
    };
  });
  const groups: ReviewGroup[] = ["REVISAR_DIARIO", "PUBLICAR_CATALOGO", "COMPLETAR_DATOS", "EXCLUIR"];

  console.log(JSON.stringify({
    total: rows.length,
    groups: Object.fromEntries(groups.map((group) => [group, rows.filter((row) => row.group === group).length])),
  }, null, 2));

  for (const group of groups) {
    const groupRows = rows.filter((row) => row.group === group);
    console.log(`\n## ${group} (${groupRows.length})`);
    for (const row of groupRows) {
      const facts = [
        row.country.code,
        row.birthYear ? `nac. ${row.birthYear}` : "sin nacimiento",
        row.fmsParticipant === null ? "FMS ?" : `FMS ${row.fmsParticipant ? "sí" : "no"}`,
        row.redBullInternational === null ? "RB ?" : `RB ${row.redBullInternational ? "sí" : "no"}`,
        `${row._count.sources} fuentes`,
        row.titleCandidates.length ? `${row.titleCandidates.length} premios Fandom` : "sin premios Fandom",
      ].join("; ");
      console.log(`- ${row.alias} (${facts}): ${row.reason}`);
    }
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
