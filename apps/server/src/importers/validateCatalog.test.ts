import { describe, expect, it } from "vitest";
import { readCandidateDetails, titleFingerprint } from "./validateCatalog";

describe("titleFingerprint", () => {
  it("normalizes naming variants for major titles", () => {
    expect(titleFingerprint("Red Bull Batalla de los Gallos Nacional España 2017"))
      .toBe("red-bull-batalla:espana:2017");
    expect(titleFingerprint("FMS España 2017/18")).toBe("fms:espana:2017");
    expect(titleFingerprint("FMS Internacional 2021")).toBe("fms:internacional:2021");
  });

  it("does not promote titles without a year or scope", () => {
    expect(titleFingerprint("FMS Argentina Temporada 1")).toBeNull();
    expect(titleFingerprint("Red Bull Regional 2023")).toBeNull();
  });
});

describe("readCandidateDetails", () => {
  it("keeps candidates across repeated validation runs", () => {
    expect(readCandidateDetails({
      source: "https://example.com",
      confirmed: ["FMS España 2022"],
      pending: ["FMS España Temporada 1"],
    })).toEqual({
      source: "https://example.com",
      candidates: ["FMS España 2022", "FMS España Temporada 1"],
    });
  });
});
