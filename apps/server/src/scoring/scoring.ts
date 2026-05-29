import type { RoundVote } from "@freestyle/shared";

export function tallyVotes(votes: RoundVote[]): { winnerId: string; votes: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const v of votes) counts[v.winnerId] = (counts[v.winnerId] || 0) + 1;
  let winnerId = ""; let max = 0;
  for (const [pid, count] of Object.entries(counts)) { if (count > max) { max = count; winnerId = pid; } }
  return { winnerId, votes: counts };
}

export function determineFinalWinner(roundWins: Record<string, number>): string {
  let winnerId = ""; let max = 0;
  for (const [pid, wins] of Object.entries(roundWins)) { if (wins > max) { max = wins; winnerId = pid; } }
  return winnerId;
}
