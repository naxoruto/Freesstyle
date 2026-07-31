import { normalizeAlias } from "../catalog/normalizeAlias";

export type CompetitionRef = { id: string; slug: string; name: string };

const COUNTRY_SLUGS = new Map([
  ["argentina", "argentina"],
  ["chile", "chile"],
  ["costa rica", "costa-rica"],
  ["espana", "espana"],
  ["mexico", "mexico"],
  ["peru", "peru"],
]);

function countrySlug(normalized: string) {
  for (const [needle, slug] of COUNTRY_SLUGS) {
    if (normalized.includes(` ${needle} `) || normalized.startsWith(`${needle} `)) return slug;
  }
  return null;
}

function existingSlug(slug: string, competitions: Map<string, CompetitionRef>) {
  return competitions.has(slug) ? slug : null;
}

export function mapExternalParticipationCompetition(normalizedCompetition: string, competitions: Map<string, CompetitionRef>) {
  const normalized = normalizeAlias(normalizedCompetition);

  if (normalized.startsWith("fms under") || normalized.includes(" fms under ")) return null;
  if (normalized.startsWith("fms ") || normalized.startsWith("freestyle master series ")) {
    return existingSlug("fms", competitions);
  }

  if (normalized.startsWith("red bull batalla") || normalized.includes("batalla de los gallos")) {
    return existingSlug("red-bull-batalla", competitions);
  }

  if (normalized.startsWith("bdm ")) {
    if (normalized.includes(" internacional ")) return existingSlug("bdm-internacional", competitions);
    const country = countrySlug(normalized);
    return country ? existingSlug(`bdm-${country}`, competitions) : null;
  }

  if (normalized.startsWith("gold battle ")) {
    if (normalized.includes(" internacional ")) return existingSlug("gold-battle-internacional", competitions);
    const country = countrySlug(normalized);
    return country ? existingSlug(`gold-battle-${country}`, competitions) : null;
  }

  if (normalized.startsWith("supremacia mc ")) {
    if (normalized.includes(" internacional ")) return existingSlug("supremacia-mc-internacional", competitions);
    const country = countrySlug(normalized);
    return country ? existingSlug(`supremacia-mc-${country}`, competitions) : null;
  }

  if (normalized.startsWith("god level")) return existingSlug("god-level", competitions);
  if (normalized.startsWith("dem battles")) return existingSlug("dem-battles", competitions);
  if (normalized.startsWith("el quinto escalon")) return existingSlug("el-quinto-escalon", competitions);
  if (normalized.startsWith("double aa")) return existingSlug("double-aa", competitions);
  if (normalized.startsWith("pangea")) return existingSlug("pangea", competitions);
  if (normalized.startsWith("kingdom")) return existingSlug("kingdom", competitions);
  if (normalized.startsWith("freestyle competition")) return existingSlug("freestyle-competition", competitions);
  if (normalized.startsWith("ghetto dreams league internacional")) return existingSlug("ghetto-dreams-league-internacional", competitions);
  if (normalized.startsWith("sangre inca internacional")) return existingSlug("sangre-inca-internacional", competitions);

  return null;
}
