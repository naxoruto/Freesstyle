import { describe, expect, it } from "vitest";
import type { Battle, BattleModeConfig, JudgeRubricVote, PatronEntryVote, PatronExtraVote, ScoreRubric } from "@freestyle/shared";
import { BattlePersistence } from "./battlePersistence";
import { getDefaultModeConfig } from "../modes/modes";

function makeBattle(overrides: Partial<Battle> = {}): Battle {
  const mode = getDefaultModeConfig("clasico");
  return {
    id: "test-battle-01",
    mode,
    status: "lobby",
    participants: [],
    judges: [],
    spectators: [],
    currentRound: 0,
    roundPhase: "countdown",
    currentTurn: "",
    timeRemaining: 0,
    entriesRemaining: {},
    totalScores: {},
    roundResults: [],
    turnSequenceIndex: 0,
    replicaCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const rubricScores = (value: number): ScoreRubric => ({
  flow: value,
  lirica: value,
  ingenio: value,
  presencia: value,
  tecnica: value,
});

describe("BattlePersistence", () => {
  const persistence = new BattlePersistence();
  const roomId = "test-persist-01";

  it("creates and reads a battle", async () => {
    const battle = makeBattle({ id: roomId });
    await persistence.create(battle);

    const loaded = await persistence.findById(roomId);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(roomId);
    expect(loaded!.status).toBe("lobby");
    expect(loaded!.mode.mode).toBe("clasico");
  });

  it("updates battle state", async () => {
    const battle = makeBattle({ id: roomId, status: "in_progress", currentRound: 2 });
    await persistence.update(battle);

    const loaded = await persistence.findById(roomId);
    expect(loaded!.status).toBe("in_progress");
    expect(loaded!.currentRound).toBe(2);
  });

  it("manages participants", async () => {
    const participant = { userId: "mc-1", name: "MC Uno", alias: "Uno", isActive: false, currentScore: 0, roundsWon: 0 };
    await persistence.addParticipant(roomId, participant);

    const loaded = await persistence.findById(roomId);
    expect(loaded!.participants).toHaveLength(1);
    expect(loaded!.participants[0].userId).toBe("mc-1");
  });

  it("manages judges", async () => {
    await persistence.addJudge(roomId, { id: "judge-1", alias: "Juez 1" });

    const loaded = await persistence.findById(roomId);
    expect(loaded!.judges).toHaveLength(1);
    expect(loaded!.judges[0].alias).toBe("Juez 1");
  });

  it("manages spectators", async () => {
    await persistence.addSpectator(roomId, { id: "viewer-1", alias: "Publico 1" });

    const loaded = await persistence.findById(roomId);
    expect(loaded!.spectators).toHaveLength(1);
    expect(loaded!.spectators[0].alias).toBe("Publico 1");
  });

  it("saves and retrieves rubric votes", async () => {
    const vote: JudgeRubricVote = {
      judgeId: "judge-1",
      judgeName: "Juez 1",
      round: 1,
      mc1Id: "mc-1",
      mc2Id: "mc-2",
      mc1Scores: rubricScores(8),
      mc2Scores: rubricScores(5),
    };
    await persistence.saveRubricVote(roomId, vote);

    const votes = await persistence.getRubricVotes(roomId, 1);
    expect(votes).toHaveLength(1);
    expect(votes[0].judgeId).toBe("judge-1");
    expect(votes[0].mc1Scores.flow).toBe(8);
  });

  it("saves and retrieves patron entry votes", async () => {
    const vote: PatronEntryVote = {
      judgeId: "judge-1",
      judgeName: "Juez 1",
      round: 1,
      entryIndex: 0,
      mcId: "mc-1",
      points: 3,
    };
    await persistence.savePatronEntryVote(roomId, "test:1:mc-1:0", vote);

    const votes = await persistence.getPatronEntryVotes(roomId, 1);
    expect(votes.length).toBeGreaterThanOrEqual(1);
    expect(votes.some((v) => v.points === 3)).toBe(true);
  });

  it("saves and retrieves patron extra votes", async () => {
    const vote: PatronExtraVote = {
      judgeId: "judge-1",
      judgeName: "Juez 1",
      round: 1,
      mc1Id: "mc-1",
      mc2Id: "mc-2",
      mc1Extra: 2,
      mc2Extra: 1,
    };
    await persistence.savePatronExtraVote(roomId, vote);

    const votes = await persistence.getPatronExtraVotes(roomId, 1);
    expect(votes).toHaveLength(1);
    expect(votes[0].mc1Extra).toBe(2);
  });

  it("saves and retrieves round results", async () => {
    await persistence.saveRoundResult(roomId, 1, { "mc-1": 40, "mc-2": 25 }, "mc-1", [
      { judgeId: "judge-1", judgeName: "Juez 1", votedForId: "mc-1" },
    ]);

    const loaded = await persistence.findById(roomId);
    expect(loaded!.roundResults).toHaveLength(1);
    expect(loaded!.roundResults[0].winnerId).toBe("mc-1");
    expect(loaded!.roundResults[0].scores).toEqual({ "mc-1": 40, "mc-2": 25 });
  });

  it("loads active battles excluding finished ones", async () => {
    await persistence.update(makeBattle({ id: roomId, status: "finished" }));

    const activeBattles = await persistence.loadActiveBattles();
    expect(activeBattles.every((b) => b.id !== roomId)).toBe(true);
  });

  it("removes participants and judges", async () => {
    const room2 = "test-persist-02";
    await persistence.create(makeBattle({ id: room2 }));
    await persistence.addParticipant(room2, { userId: "mc-x", name: "X", alias: "X", isActive: false, currentScore: 0, roundsWon: 0 });
    await persistence.addJudge(room2, { id: "judge-x", alias: "JX" });

    await persistence.removeParticipant(room2, "mc-x");
    await persistence.removeJudge(room2, "judge-x");

    const loaded = await persistence.findById(room2);
    expect(loaded!.participants).toHaveLength(0);
    expect(loaded!.judges).toHaveLength(0);

    await persistence.delete(room2);
  });

  it("deletes a battle", async () => {
    const room3 = "test-persist-03";
    await persistence.create(makeBattle({ id: room3 }));
    await persistence.delete(room3);

    const loaded = await persistence.findById(room3);
    expect(loaded).toBeNull();
  });
});
