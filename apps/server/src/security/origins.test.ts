import { describe, expect, it } from "vitest";
import { createOriginPolicy } from "./origins";

describe("origin policy", () => {
  it("allows configured origins and requests without an Origin header", () => {
    const allow = createOriginPolicy("https://arena.example, https://www.arena.example");
    expect(allow("https://arena.example")).toBe(true);
    expect(allow("https://www.arena.example")).toBe(true);
    expect(allow(undefined)).toBe(true);
    expect(allow("https://evil.example")).toBe(false);
  });

  it("allows local development origins when no list is configured", () => {
    expect(createOriginPolicy(undefined)("http://localhost:3002")).toBe(true);
  });
});
