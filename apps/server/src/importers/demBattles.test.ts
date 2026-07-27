import { describe, expect, it } from "vitest";
import { isAliasMentioned } from "./demBattles";

describe("isAliasMentioned", () => {
  const text = "Participaron [[Metalingüística]], El Menor y Teorema en DEM Battles.";

  it("matches normalized aliases as complete names", () => {
    expect(isAliasMentioned(text, "Metalingüística")).toBe(true);
    expect(isAliasMentioned(text, "El Menor")).toBe(true);
    expect(isAliasMentioned(text, "Teorema")).toBe(true);
  });

  it("rejects short or partial aliases", () => {
    expect(isAliasMentioned(text, "MC")).toBe(false);
    expect(isAliasMentioned(text, "Teo")).toBe(false);
  });

  it("accepts an explicitly trusted short alias", () => {
    expect(isAliasMentioned("Final: WOS vs Klan", "Wos", true)).toBe(true);
  });
});
