import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rateLimit";

describe("rate limiter", () => {
  it("limits each client independently and resets after its window", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.consume("a")).toBe(true);
    expect(limiter.consume("a")).toBe(true);
    expect(limiter.consume("a")).toBe(false);
    expect(limiter.consume("b")).toBe(true);
    now = 1000;
    expect(limiter.consume("a")).toBe(true);
  });

  it("bounds tracked clients and releases expired entries", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now, 2);
    expect(limiter.consume("a")).toBe(true);
    expect(limiter.consume("b")).toBe(true);
    expect(limiter.consume("c")).toBe(false);
    now = 1000;
    expect(limiter.consume("c")).toBe(true);
  });
});
