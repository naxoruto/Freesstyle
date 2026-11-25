import { describe, expect, it } from "vitest";
import { checkReadiness } from "./readiness";

describe("database readiness", () => {
  it("reports ready when the database responds", async () => {
    expect(await checkReadiness(async () => undefined)).toEqual({ status: "ready", database: "ok" });
  });

  it("reports unavailable without exposing database errors", async () => {
    const result = await checkReadiness(async () => { throw new Error("sensitive connection details"); });
    expect(result).toEqual({ status: "unavailable", database: "unavailable" });
  });
});
