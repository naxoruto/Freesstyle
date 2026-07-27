import { describe, expect, it } from "vitest";
import { candidateSlug, countryCodeFromCategories, countryCodeFromOrigin } from "./discoverFandom";

describe("Fandom discovery helpers", () => {
  it("detects initial countries from MediaWiki categories", () => {
    expect(countryCodeFromCategories(["Categoría:Freestylers", "Categoría:México"])).toBe("MX");
    expect(countryCodeFromCategories(["Categoría:España", "Categoría:MCs"])).toBe("ES");
    expect(countryCodeFromCategories(["Categoría:Venezuela"])).toBe("VE");
    expect(countryCodeFromCategories(["Categoría:República Dominicana"])).toBe("DO");
  });

  it("detects countries from infobox origin when categories are incomplete", () => {
    expect(countryCodeFromOrigin("Puente Alto, Chile")).toBe("CL");
    expect(countryCodeFromOrigin("San Pedro De Macoris, República Dominicana")).toBe("DO");
    expect(countryCodeFromOrigin("Maracay, Venezuela")).toBe("VE");
  });

  it("creates stable ASCII slugs", () => {
    expect(candidateSlug("Jony Beltrán", 123)).toBe("jony-beltran");
    expect(candidateSlug("Ñko", 123)).toBe("nko");
  });
});
