import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { normalizeAlias } from "./normalizeAlias";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 2000;

const freestylerSummary = {
  id: true,
  slug: true,
  alias: true,
  realName: true,
  active: true,
  birthYear: true,
  debutYear: true,
  fmsParticipant: true,
  redBullInternational: true,
  catalogStatus: true,
  styles: {
    select: {
      rank: true,
      styleTag: { select: { slug: true, name: true } },
    },
    orderBy: { rank: "asc" },
  },
  country: {
    select: {
      code: true,
      name: true,
      flagEmoji: true,
    },
  },
  _count: {
    select: {
      sources: true,
      reviewIssues: {
        where: { status: "OPEN" },
      },
      titles: true,
      participations: true,
      battlesAsCompetitor1: true,
      battlesAsCompetitor2: true,
    },
  },
} satisfies Prisma.FreestylerSelect;

export function parseCatalogSearch(query: unknown, requestedLimit: unknown) {
  const q = typeof query === "string" ? normalizeAlias(query).slice(0, 80) : "";
  const parsedLimit = typeof requestedLimit === "string" ? Number.parseInt(requestedLimit, 10) : DEFAULT_LIMIT;
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  return { q, limit };
}

export async function searchFreestylers(query: unknown, requestedLimit: unknown) {
  const { q, limit } = parseCatalogSearch(query, requestedLimit);

  const freestylers = await prisma.freestyler.findMany({
    where: {
      catalogStatus: { not: "REJECTED" },
      ...(q ? { normalizedAlias: { contains: q } } : {}),
    },
    select: freestylerSummary,
    orderBy: [{ country: { name: "asc" } }, { alias: "asc" }],
    take: limit,
  });

  return freestylers.map((freestyler) => ({
    ...freestyler,
    eligibleForDaily: Boolean(
      freestyler.birthYear &&
      freestyler._count.sources >= 2 &&
      (freestyler.fmsParticipant === true || freestyler.redBullInternational === true || freestyler._count.titles > 0 || freestyler._count.participations > 0 || freestyler._count.battlesAsCompetitor1 > 0 || freestyler._count.battlesAsCompetitor2 > 0),
    ),
  }));
}

export async function getFreestylerProfile(slug: string) {
  return prisma.freestyler.findFirst({
    where: { slug, catalogStatus: { not: "REJECTED" } },
    select: {
      alias: true,
      realName: true,
      birthYear: true,
      debutYear: true,
      fmsParticipant: true,
      redBullInternational: true,
      country: { select: { code: true, name: true, flagEmoji: true } },
      aliases: { select: { alias: true }, orderBy: { alias: "asc" } },
      styles: { select: { rank: true, styleTag: { select: { name: true } } }, orderBy: { rank: "asc" } },
      titles: {
        select: { label: true, wonAt: true, competition: { select: { name: true } } },
        orderBy: [{ wonAt: "desc" }, { label: "asc" }],
      },
      participations: {
        select: { finalPosition: true, competition: { select: { name: true } }, season: { select: { name: true } } },
        orderBy: { competition: { name: "asc" } },
      },
      sources: { select: { source: { select: { name: true, url: true } } }, orderBy: { source: { name: "asc" } } },
    },
  });
}
