import { describe, expect, it } from "vitest";
import { generateShortId } from "./id";

describe("generateShortId", () => {
  it("devuelve 8 caracteres por defecto", () => {
    expect(generateShortId()).toHaveLength(8);
  });

  it("respeta una longitud personalizada", () => {
    expect(generateShortId(12)).toHaveLength(12);
  });

  it("usa solo minúsculas y dígitos", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateShortId()).toMatch(/^[0-9a-z]{8}$/);
    }
  });

  it("genera valores distintos", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateShortId()));
    expect(ids.size).toBe(1000);
  });
});
