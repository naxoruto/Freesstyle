import { describe, expect, it } from "vitest";
import type { JudgeRubricVote, ScoreRubric } from "@freestyle/shared";
import { calculatePatronResult, calculateRubricResult, isValidRubric, sumRubric } from "./scoring";

const rubric = (value: number): ScoreRubric => ({
  flow: value,
  lirica: value,
  ingenio: value,
  presencia: value,
  tecnica: value,
});

const vote = (mc1: number, mc2: number): JudgeRubricVote => ({
  judgeId: "judge",
  judgeName: "Judge",
  round: 1,
  mc1Id: "mc1",
  mc2Id: "mc2",
  mc1Scores: rubric(mc1),
  mc2Scores: rubric(mc2),
});

describe("rubric scoring", () => {
  it("validates every rubric dimension", () => {
    expect(isValidRubric(rubric(10))).toBe(true);
    expect(isValidRubric({ ...rubric(5), flow: 11 })).toBe(false);
    expect(isValidRubric({ ...rubric(5), tecnica: 2.5 })).toBe(false);
  });

  it("sums rubric dimensions", () => {
    expect(sumRubric(rubric(8))).toBe(40);
  });

  it("calculates a winner without resolving ties arbitrarily", () => {
    expect(calculateRubricResult([vote(8, 5)])).toEqual({
      scores: { mc1: 40, mc2: 25 },
      winnerId: "mc1",
    });
    expect(calculateRubricResult([vote(5, 5)])).toEqual({
      scores: { mc1: 25, mc2: 25 },
      winnerId: undefined,
    });
  });

  it("adds pattern entries and final extras", () => {
    const result = calculatePatronResult(
      [
        { judgeId: "j", judgeName: "J", round: 1, entryIndex: 0, mcId: "mc1", points: 4 },
        { judgeId: "j", judgeName: "J", round: 1, entryIndex: 0, mcId: "mc2", points: 2 },
      ],
      [{ judgeId: "j", judgeName: "J", round: 1, mc1Id: "mc1", mc2Id: "mc2", mc1Extra: 3, mc2Extra: 4 }],
    );
    expect(result).toEqual({ scores: { mc1: 7, mc2: 6 }, winnerId: "mc1" });
  });
});
