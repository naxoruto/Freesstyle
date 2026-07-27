import { describe, expect, it } from "vitest";
import { freestyleStatsSlug, parseFreestyleStatsProfile } from "./freestyleStats";

describe("Freestyle Stats importer", () => {
  it("builds profile slugs and extracts secondary profile facts", () => {
    expect(freestyleStatsSlug("Éxodo Lirical")).toBe("exodolirical");
    expect(parseFreestyleStatsProfile(`<p>Nombre real Pedro Elias Aquino Cova Nacimiento 16 de noviembre de 1991</p><a href="/competition/god-level-fest/2014">God Level Fest</a><h2>Últimos títulos</h2>Ver todos God Level Fest Temporada 2014 Medalla de oro Últimas jornadas`)).toEqual({
      realName: "Pedro Elias Aquino Cova",
      birthYear: 1991,
      competitionCandidates: ["God Level Fest"],
      titleCandidates: [{ competitionSlug: "god-level-fest", competitionName: "God Level Fest" }],
    });
  });
});
