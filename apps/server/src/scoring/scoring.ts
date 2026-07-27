import type { JudgeRubricVote, PatronEntryVote, PatronExtraVote, ScoreRubric } from "@freestyle/shared";

const RUBRIC_KEYS: (keyof ScoreRubric)[] = ["flow", "lirica", "ingenio", "presencia", "tecnica"];

export function isValidRubric(scores: ScoreRubric): boolean {
  return RUBRIC_KEYS.every((key) => Number.isInteger(scores[key]) && scores[key] >= 0 && scores[key] <= 10);
}

export function sumRubric(scores: ScoreRubric): number {
  return RUBRIC_KEYS.reduce((total, key) => total + scores[key], 0);
}

export function calculateRubricResult(votes: JudgeRubricVote[]): {
  scores: Record<string, number>;
  winnerId?: string;
} {
  const scores: Record<string, number> = {};
  for (const vote of votes) {
    scores[vote.mc1Id] = (scores[vote.mc1Id] ?? 0) + sumRubric(vote.mc1Scores);
    scores[vote.mc2Id] = (scores[vote.mc2Id] ?? 0) + sumRubric(vote.mc2Scores);
  }

  const sorted = Object.entries(scores).sort(([, left], [, right]) => right - left);
  const winnerId = sorted.length >= 2 && sorted[0][1] !== sorted[1][1] ? sorted[0][0] : undefined;
  return { scores, winnerId };
}

export function calculatePatronResult(entryVotes: PatronEntryVote[], extraVotes: PatronExtraVote[]): {
  scores: Record<string, number>;
  winnerId?: string;
} {
  const scores: Record<string, number> = {};
  for (const vote of entryVotes) scores[vote.mcId] = (scores[vote.mcId] ?? 0) + vote.points;
  for (const vote of extraVotes) {
    scores[vote.mc1Id] = (scores[vote.mc1Id] ?? 0) + vote.mc1Extra;
    scores[vote.mc2Id] = (scores[vote.mc2Id] ?? 0) + vote.mc2Extra;
  }
  const sorted = Object.entries(scores).sort(([, left], [, right]) => right - left);
  const winnerId = sorted.length >= 2 && sorted[0][1] !== sorted[1][1] ? sorted[0][0] : undefined;
  return { scores, winnerId };
}
