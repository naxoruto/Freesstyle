import { describe, expect, it } from "vitest";
import { parseFreestyleStatsBattle } from "./freestyleStatsBattles";

describe("Freestyle Stats battle importer", () => {
  it("extracts competitors, competition and winner from a battle page", () => {
    expect(parseFreestyleStatsBattle("Aczino vs Éxodo Lirical - FMS Internacional - 2025 / 2026 - Gran final | Freestyle Stats Aczino 4 - Éxodo Lirical 0")).toEqual({
      competitor1: "Aczino",
      competitor2: "Éxodo Lirical",
      competition: "FMS Internacional",
      season: "2025 / 2026",
      stage: "Gran final",
      score1: 4,
      score2: 0,
    });
  });
});
