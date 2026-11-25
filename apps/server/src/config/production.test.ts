import { describe, expect, it } from "vitest";
import { validateProductionConfig } from "./production";

describe("production configuration", () => {
  it("requires the database URL and strong inventory and session secrets in production", () => {
    expect(() => validateProductionConfig({ NODE_ENV: "production" })).toThrow();
    expect(() => validateProductionConfig({ NODE_ENV: "production", DATABASE_URL: "postgresql://db", INVENTORY_ADMIN_TOKEN: "short", SESSION_HASH_SALT: "short" })).toThrow();
    expect(() => validateProductionConfig({ NODE_ENV: "production", DATABASE_URL: "postgresql://db", INVENTORY_ADMIN_TOKEN: "a".repeat(32), SESSION_HASH_SALT: "b".repeat(32), ALLOWED_ORIGINS: "https://arena.example" })).not.toThrow();
  });

  it("does not require production secrets in development", () => {
    expect(() => validateProductionConfig({ NODE_ENV: "development" })).not.toThrow();
  });
});
