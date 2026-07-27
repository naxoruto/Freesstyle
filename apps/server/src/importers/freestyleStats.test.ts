import { describe, expect, it } from "vitest";
import { freestyleStatsSlug, parseFreestyleStatsProfile } from "./freestyleStats";

describe("Freestyle Stats importer", () => {
  it("builds profile slugs and extracts secondary profile facts", () => {
    expect(freestyleStatsSlug("Éxodo Lirical")).toBe("exodolirical");
    expect(parseFreestyleStatsProfile(`<p>Nombre real Pedro Elias Aquino Cova Nacimiento 16 de noviembre de 1991</p><a href="/competition/god-level-fest/2014">God Level Fest</a><span>Medalla de oro</span>`)).toEqual({
      realName: "Pedro Elias Aquino Cova",
      birthYear: 1991,
      competitionCandidates: ["God Level Fest"],
      titleCandidates: [{ competitionSlug: "god-level-fest", competitionName: "God Level Fest" }],
    });
  });
});
