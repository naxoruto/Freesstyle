import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeAlias } from "../catalog/normalizeAlias";

export interface ExternalProfileInput {
  provider: string;
  externalId: string;
  canonicalUrl: string;
  sourceAlias: string;
  countryCode?: string | null;
  realName?: string | null;
  birthDate?: Date | null;
  birthYear?: number | null;
  parseStatus?: string;
  payload?: Prisma.JsonValue;
  runId: string;
}

export interface ExternalParticipationInput {
  competitionName: string;
  season?: string | null;
  eventName?: string | null;
  stage?: string | null;
  sourceUrl?: string | null;
}

export interface ExternalWinInput {
  competitionName: string;
  label: string;
  season?: string | null;
  eventName?: string | null;
  year?: number | null;
  category?: string;
  countsForDaily?: boolean;
  sourceUrl?: string | null;
}

export function contentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createImportRun(
  prisma: PrismaClient,
  provider: string,
  kind: string,
  metadata?: Prisma.JsonValue,
) {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO catalog_import_runs (id, provider, kind, metadata)
    VALUES (${id}, ${provider}, ${kind}, CAST(${JSON.stringify(metadata ?? {})} AS jsonb))
  `;
  return id;
}

export async function completeImportRun(
  prisma: PrismaClient,
  runId: string,
  data: { status: string; discovered: number; fetched: number; parsed: number; failed: number; error?: string | null },
) {
  await prisma.$executeRaw`
    UPDATE catalog_import_runs
    SET status = ${data.status}, completed_at = NOW(), discovered_count = ${data.discovered},
      fetched_count = ${data.fetched}, parsed_count = ${data.parsed}, failed_count = ${data.failed}, error = ${data.error ?? null}
    WHERE id = ${runId}
  `;
}

export async function upsertExternalProfile(prisma: PrismaClient, input: ExternalProfileInput) {
  const id = randomUUID();
  const normalizedAlias = normalizeAlias(input.sourceAlias);
  const payload = JSON.stringify(input.payload ?? {});
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO external_profiles (
      id, provider, external_id, canonical_url, source_alias, normalized_alias, country_code,
      real_name, birth_date, birth_year, parse_status, content_hash, payload, last_seen_run_id, updated_at
    ) VALUES (
      ${id}, ${input.provider}, ${input.externalId}, ${input.canonicalUrl}, ${input.sourceAlias}, ${normalizedAlias},
      ${input.countryCode ?? null}, ${input.realName ?? null}, ${input.birthDate ?? null}, ${input.birthYear ?? null},
      ${input.parseStatus ?? "PARSED"}, ${contentHash(payload)}, CAST(${payload} AS jsonb), ${input.runId}, NOW()
    )
    ON CONFLICT (provider, external_id) DO UPDATE SET
      canonical_url = EXCLUDED.canonical_url,
      source_alias = EXCLUDED.source_alias,
      normalized_alias = EXCLUDED.normalized_alias,
      country_code = EXCLUDED.country_code,
      real_name = EXCLUDED.real_name,
      birth_date = EXCLUDED.birth_date,
      birth_year = EXCLUDED.birth_year,
      parse_status = EXCLUDED.parse_status,
      content_hash = EXCLUDED.content_hash,
      payload = EXCLUDED.payload,
      last_seen_at = NOW(),
      last_seen_run_id = EXCLUDED.last_seen_run_id,
      updated_at = NOW()
    RETURNING id
  `;
  return rows[0].id;
}

export async function replaceExternalAliases(prisma: PrismaClient, externalProfileId: string, aliases: string[]) {
  await prisma.$executeRaw`DELETE FROM external_profile_aliases WHERE external_profile_id = ${externalProfileId}`;
  for (const alias of [...new Set(aliases.filter(Boolean))]) {
    await prisma.$executeRaw`
      INSERT INTO external_profile_aliases (id, external_profile_id, alias, normalized_alias)
      VALUES (${randomUUID()}, ${externalProfileId}, ${alias}, ${normalizeAlias(alias)})
      ON CONFLICT (external_profile_id, normalized_alias) DO NOTHING
    `;
  }
}

export async function replaceExternalParticipations(
  prisma: PrismaClient,
  externalProfileId: string,
  participations: ExternalParticipationInput[],
) {
  await prisma.$executeRaw`DELETE FROM external_participations WHERE external_profile_id = ${externalProfileId}`;
  for (const participation of participations) {
    await prisma.$executeRaw`
      INSERT INTO external_participations (
        id, external_profile_id, competition_name, normalized_competition, season, event_name, stage, source_url
      ) VALUES (
        ${randomUUID()}, ${externalProfileId}, ${participation.competitionName}, ${normalizeAlias(participation.competitionName)},
        ${participation.season ?? null}, ${participation.eventName ?? null}, ${participation.stage ?? null}, ${participation.sourceUrl ?? null}
      )
      ON CONFLICT (external_profile_id, normalized_competition, season, event_name, stage) DO NOTHING
    `;
  }
}

export async function replaceExternalWins(prisma: PrismaClient, externalProfileId: string, wins: ExternalWinInput[]) {
  await prisma.$executeRaw`DELETE FROM external_wins WHERE external_profile_id = ${externalProfileId}`;
  for (const win of wins) {
    await prisma.$executeRaw`
      INSERT INTO external_wins (
        id, external_profile_id, competition_name, normalized_competition, label, season, event_name,
        year, category, counts_for_daily, source_url
      ) VALUES (
        ${randomUUID()}, ${externalProfileId}, ${win.competitionName}, ${normalizeAlias(win.competitionName)}, ${win.label},
        ${win.season ?? null}, ${win.eventName ?? null}, ${win.year ?? null}, ${win.category ?? "OTHER"},
        ${win.countsForDaily ?? false}, ${win.sourceUrl ?? null}
      )
      ON CONFLICT (external_profile_id, normalized_competition, label) DO NOTHING
    `;
  }
}
