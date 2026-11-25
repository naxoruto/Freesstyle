import { describe, expect, it } from "vitest";
import { authorizeInventory } from "./access";

describe("inventory access", () => {
  const secret = "a".repeat(48);

  it("allows the configured bearer credential", () => {
    expect(authorizeInventory(secret, `Bearer ${secret}`)).toBe(true);
  });

  it("rejects missing, short, malformed and incorrect credentials", () => {
    expect(authorizeInventory(undefined, `Bearer ${secret}`)).toBe(false);
    expect(authorizeInventory("short", "Bearer short")).toBe(false);
    expect(authorizeInventory(secret, undefined)).toBe(false);
    expect(authorizeInventory(secret, secret)).toBe(false);
    expect(authorizeInventory(secret, `Bearer ${"b".repeat(48)}`)).toBe(false);
  });
});
