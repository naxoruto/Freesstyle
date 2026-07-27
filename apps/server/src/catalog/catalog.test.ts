import { describe, expect, it } from "vitest";
import { parseCatalogSearch } from "./catalog";
import { normalizeAlias } from "./normalizeAlias";

describe("normalizeAlias", () => {
  it("normalizes accents, case and whitespace", () => {
    expect(normalizeAlias("  Marithéa  ")).toBe("marithea");
    expect(normalizeAlias("LOBO---ESTEPARIO")).toBe("lobo estepario");
  });
});

describe("parseCatalogSearch", () => {
  it("sanitizes the query and bounds the result limit", () => {
    expect(parseCatalogSearch("  ACZÍNO ", "200")).toEqual({ q: "aczino", limit: 100 });
    expect(parseCatalogSearch(undefined, "invalid")).toEqual({ q: "", limit: 10 });
    expect(parseCatalogSearch("Wos", "0")).toEqual({ q: "wos", limit: 1 });
  });
});
