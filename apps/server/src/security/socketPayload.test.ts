import { describe, expect, it } from "vitest";
import { isSocketPayloadValid } from "./socketPayload";

describe("socket payload validation", () => {
  it("requires an explicit valid recovery decision", () => {
    expect(isSocketPayloadValid("battle:resume", { action: "continue" })).toBe(true);
    expect(isSocketPayloadValid("battle:resume", { action: "restart_clock" })).toBe(true);
    expect(isSocketPayloadValid("battle:resume", {})).toBe(false);
    expect(isSocketPayloadValid("battle:resume", { action: "skip" })).toBe(false);
  });
  it("accepts a well-formed join and payload-free event", () => {
    expect(isSocketPayloadValid("battle:join", { battleId: "1234", user: { id: "abc", name: "MC", alias: "MC" } })).toBe(true);
    expect(isSocketPayloadValid("battle:start", undefined)).toBe(true);
  });

  it("rejects missing identity, invalid scores and unknown events", () => {
    expect(isSocketPayloadValid("battle:join", {})).toBe(false);
    expect(isSocketPayloadValid("battle:join", { battleId: "1234", user: { id: 123, alias: "MC" } })).toBe(false);
    expect(isSocketPayloadValid("judge:vote_rubric", { battleId: "a", round: 1, mc1Id: "a", mc2Id: "b", mc1Scores: null, mc2Scores: {} })).toBe(false);
    expect(isSocketPayloadValid("unknown", {})).toBe(false);
    expect(isSocketPayloadValid("battle:set_mode", { mode: null })).toBe(false);
  });
});
