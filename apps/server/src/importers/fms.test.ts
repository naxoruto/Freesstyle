import { describe, expect, it } from "vitest";
import { parseFmsDate } from "./fms";

describe("parseFmsDate", () => {
  it("parses valid dd/mm/yyyy dates", () => {
    expect(parseFmsDate("02/07/1991")?.toISOString()).toBe("1991-07-02T00:00:00.000Z");
  });

  it("rejects missing and invalid dates", () => {
    expect(parseFmsDate("")).toBeNull();
    expect(parseFmsDate("31/02/2000")).toBeNull();
    expect(parseFmsDate("1991-07-02")).toBeNull();
  });
});
