import { describe, expect, it } from "vitest";
import { compareFreestylers, dateKeyFor, deterministicIndex } from "./freestylerDaily";

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: "guess",
    alias: "Guess",
    birthYear: 1998,
    fmsParticipant: true,
    redBullInternational: true,
    country: { code: "AR", name: "Argentina" },
    titles: [
      { competition: { slug: "fms" } },
      { competition: { slug: "red-bull-batalla" } },
    ],
    ...overrides,
  };
}

describe("daily challenge helpers", () => {
  it("uses the Argentina date boundary", () => {
    expect(dateKeyFor(new Date("2026-07-27T02:30:00.000Z"))).toBe("2026-07-26");
    expect(dateKeyFor(new Date("2026-07-27T04:00:00.000Z"))).toBe("2026-07-27");
  });

  it("selects a stable index for the same date", () => {
    expect(deterministicIndex("2026-07-27", 27)).toBe(deterministicIndex("2026-07-27", 27));
    expect(deterministicIndex("2026-07-27", 27)).toBeLessThan(27);
  });

  it("compares public attributes without exposing the answer", () => {
    const result = compareFreestylers(
      profile(),
      profile({
        id: "answer",
        alias: "Answer",
        birthYear: 1991,
        country: { code: "MX", name: "México" },
        titles: [],
      }),
      "2026-07-27",
    );

    expect(result.isCorrect).toBe(false);
    expect(result.attributes.country.status).toBe("miss");
    expect(result.attributes.birthYear.direction).toBe("lower");
    expect(result.attributes.titles.direction).toBe("lower");
    expect(JSON.stringify(result)).not.toContain("Answer");
  });

  it("marks the matching profile as the correct answer", () => {
    const target = profile();
    const result = compareFreestylers(target, target, "2026-07-27");

    expect(result.isCorrect).toBe(true);
    expect(Object.values(result.attributes).every((attribute) => attribute.status === "exact")).toBe(true);
  });
});
