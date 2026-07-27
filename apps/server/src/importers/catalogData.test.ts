import { describe, expect, it } from "vitest";
import { normalizeAlias } from "../catalog/normalizeAlias";
import { freestylers } from "./catalogSeedData";
import { VERIFIED_PROFILES } from "./verifiedCatalog";
import { VERIFIED_STYLES } from "./verifiedStyles";

describe("catalog data", () => {
  it("seeds every reviewed profile with a unique identity and styles", () => {
    const seededAliases = freestylers.map(({ alias }) => normalizeAlias(alias));
    const reviewedAliases = VERIFIED_PROFILES.map(({ alias }) => normalizeAlias(alias));

    expect(new Set(freestylers.map(({ slug }) => slug)).size).toBe(freestylers.length);
    expect(new Set(seededAliases).size).toBe(freestylers.length);
    expect(new Set(reviewedAliases).size).toBe(VERIFIED_PROFILES.length);
    expect(new Set(seededAliases)).toEqual(new Set(reviewedAliases));
    expect(VERIFIED_PROFILES.every(({ alias }) => VERIFIED_STYLES[alias]?.length === 2)).toBe(true);
  });
});
