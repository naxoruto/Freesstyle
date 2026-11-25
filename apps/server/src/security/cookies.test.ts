import { describe, expect, it } from "vitest";
import { parseCookies } from "./cookies";

describe("parseCookies", () => {
  it("parses a cookie header", () => {
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });

  it("returns empty for an undefined header", () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it("decodes URI components", () => {
    expect(parseCookies("token=abc%20123")).toEqual({ token: "abc 123" });
  });

  it("ignores malformed parts", () => {
    expect(parseCookies("a=1; ; b")).toEqual({ a: "1" });
  });
});
