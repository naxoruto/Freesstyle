import { describe, expect, it, vi } from "vitest";
import { getDefaultModeConfig } from "../modes/modes";
import { BattleRoomManager } from "./battleRoom";
import { TournamentRoomManager } from "./tournamentRoom";

vi.mock("./battlePersistence", () => ({
  BattlePersistence: class {
    create = vi.fn().mockResolvedValue(undefined);
    update = vi.fn().mockResolvedValue(undefined);
  },
}));

describe("TournamentRoomManager", () => {
  it("creates a tournament with all participants in one operation", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const result = manager.createTournamentWithParticipants("Copa", "manual", "single_elimination", ["A", "B", "C", "D"]);
    expect(result?.tournament.participants.map(participant => participant.alias)).toEqual(["A", "B", "C", "D"]);
    expect(result?.adminToken).toBeTruthy();
  });

  it("rejects an invalid participant list without creating a tournament", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    expect(manager.createTournamentWithParticipants("Copa", "manual", "single_elimination", ["A", "B", "C", " "])).toBeNull();
    expect(manager.createTournamentWithParticipants("Copa", "manual", "single_elimination", ["A", "B", "C"])).toBeNull();
  });

  it("rechaza capacidad y tipo inválidos", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    expect(manager.createTournament("Copa", "random", "single_elimination", { capacity: 3 })).toBeNull();
    expect(manager.createTournament("Copa", "random", "single_elimination", { capacity: 7 })).toBeNull();
    expect(manager.createTournament("Copa", "random", "king_of_the_hill")).toBeNull();
    expect(manager.createTournament("Copa", "random", "single_elimination", { capacity: 16 })).not.toBeNull();
  });
  it("builds a bracket and advances winners to the final", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual")!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);

    expect(manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"))).toBe(tournament);
    expect(tournament.phases).toHaveLength(2);
    expect(tournament.phases[0].battles).toHaveLength(2);

    const [first, second] = tournament.phases[0].battles;
    expect(manager.getBattleAdminToken(tournament.id, adminToken, first.battleId!)).toBeTruthy();
    expect(manager.getBattleAdminToken(tournament.id, "invalid", first.battleId!)).toBeNull();
    manager.recordWinner(tournament.id, adminToken, first.battleId!, first.mc1Id!);
    manager.recordWinner(tournament.id, adminToken, second.battleId!, second.mc1Id!);

    expect(tournament.currentPhaseIndex).toBe(1);
    expect(tournament.phases[1].battles[0]).toMatchObject({ mc1Id: first.mc1Id, mc2Id: second.mc1Id });
    expect(tournament.phases[1].battles[0].battleId).toBeTruthy();
  });

  it("requires a power-of-two participant count", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual")!;
    for (const alias of ["A", "B", "C"]) manager.addParticipant(tournament.id, adminToken, alias);
    expect(manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"))).toBeNull();
  });

  it("accepts automatic results from completed battle rooms", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual")!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    const match = tournament.phases[0].battles[0];

    expect(manager.recordBattleResult(match.battleId!, match.mc1Id!)).toBe(tournament);
    expect(match.winnerId).toBe(match.mc1Id);
  });

  it("reorders participants during setup and the bracket respects the new order", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual")!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    const [a, b, c, d] = tournament.participants;

    const reordered = manager.reorderParticipants(tournament.id, adminToken, [d.userId, a.userId, b.userId, c.userId]);
    expect(reordered).toBe(tournament);
    expect(tournament.participants.map(participant => participant.alias)).toEqual(["D", "A", "B", "C"]);

    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    const [first, second] = tournament.phases[0].battles;
    expect(first).toMatchObject({ mc1Id: d.userId, mc2Id: a.userId });
    expect(second).toMatchObject({ mc1Id: b.userId, mc2Id: c.userId });
  });

  it("rejects reorder with an invalid admin token", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual")!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    const ids = tournament.participants.map(participant => participant.userId);

    expect(manager.reorderParticipants(tournament.id, "invalid-token", [...ids].reverse())).toBeNull();
    expect(tournament.participants.map(participant => participant.userId)).toEqual(ids);
  });

  it("rejects reorder once the tournament has started", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual")!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    const ids = tournament.participants.map(participant => participant.userId);

    expect(manager.reorderParticipants(tournament.id, adminToken, [...ids].reverse())).toBeNull();
    expect(tournament.participants.map(participant => participant.userId)).toEqual(ids);
  });

  it("rejects reorder with missing, duplicate or unknown ids", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual")!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    const ids = tournament.participants.map(participant => participant.userId);

    expect(manager.reorderParticipants(tournament.id, adminToken, ids.slice(1))).toBeNull();
    expect(manager.reorderParticipants(tournament.id, adminToken, [ids[0], ids[0], ids[1], ids[2]])).toBeNull();
    expect(manager.reorderParticipants(tournament.id, adminToken, [...ids.slice(1), "unknown-id"])).toBeNull();
    expect(tournament.participants.map(participant => participant.userId)).toEqual(ids);
  });

  it("runs a four-player double-elimination bracket and reaches the grand final", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Repesca", "manual", "double_elimination")!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    const [a, b, c, d] = tournament.participants;

    expect(manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"))).toBe(tournament);
    expect(tournament.losersPhases).toHaveLength(2);
    const [first, second] = tournament.phases[0].battles;
    manager.recordWinner(tournament.id, adminToken, first.battleId!, a.userId);
    manager.recordWinner(tournament.id, adminToken, second.battleId!, c.userId);

    const winnersFinal = tournament.phases[1].battles[0];
    expect(winnersFinal).toMatchObject({ mc1Id: a.userId, mc2Id: c.userId });
    manager.recordWinner(tournament.id, adminToken, winnersFinal.battleId!, a.userId);

    const losersRound = tournament.losersPhases![0].battles[0];
    expect(losersRound).toMatchObject({ mc1Id: b.userId, mc2Id: d.userId });
    manager.recordWinner(tournament.id, adminToken, losersRound.battleId!, b.userId);

    const losersFinal = tournament.losersPhases![1].battles[0];
    expect(losersFinal).toMatchObject({ mc1Id: b.userId, mc2Id: c.userId });
    manager.recordWinner(tournament.id, adminToken, losersFinal.battleId!, b.userId);

    expect(tournament.grandFinal).toMatchObject({ mc1Id: a.userId, mc2Id: b.userId });
    manager.recordWinner(tournament.id, adminToken, tournament.grandFinal!.battleId!, a.userId);
    expect(tournament).toMatchObject({ status: "finished", winnerId: a.userId });
  });

  it("creates a reset final when the repesca champion beats the undefeated champion", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Repesca", "manual", "double_elimination")!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    const [first, second] = tournament.phases[0].battles;
    manager.recordWinner(tournament.id, adminToken, first.battleId!, first.mc1Id!);
    manager.recordWinner(tournament.id, adminToken, second.battleId!, second.mc1Id!);
    const winnersFinal = tournament.phases[1].battles[0];
    manager.recordWinner(tournament.id, adminToken, winnersFinal.battleId!, winnersFinal.mc1Id!);
    const losersRound = tournament.losersPhases![0].battles[0];
    manager.recordWinner(tournament.id, adminToken, losersRound.battleId!, losersRound.mc1Id!);
    const losersFinal = tournament.losersPhases![1].battles[0];
    manager.recordWinner(tournament.id, adminToken, losersFinal.battleId!, losersFinal.mc1Id!);
    manager.recordWinner(tournament.id, adminToken, tournament.grandFinal!.battleId!, tournament.grandFinal!.mc2Id!);

    expect(tournament.status).toBe("in_progress");
    expect(tournament.grandFinalReset?.battleId).toBeTruthy();
    manager.recordWinner(tournament.id, adminToken, tournament.grandFinalReset!.battleId!, tournament.grandFinalReset!.mc2Id!);
    expect(tournament).toMatchObject({ status: "finished", winnerId: tournament.grandFinalReset!.mc2Id });
  });

  it("generates the standard loser bracket sizes for 8 and 16 participants", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    for (const [count, expected] of [[8, [2, 2, 1, 1]], [16, [4, 4, 2, 2, 1, 1]]] as const) {
      const { tournament, adminToken } = manager.createTournament(`Repesca ${count}`, "manual", "double_elimination")!;
      for (let index = 0; index < count; index++) manager.addParticipant(tournament.id, adminToken, `MC ${index + 1}`);
      expect(manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"))).toBe(tournament);
      expect(tournament.losersPhases?.map(phase => phase.battles.length)).toEqual(expected);
    }
  });

  it("advances an 8-player loser bracket into the grand final", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Repesca 8", "manual", "double_elimination")!;
    for (let index = 0; index < 8; index++) manager.addParticipant(tournament.id, adminToken, `MC ${index + 1}`);
    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));

    for (const match of tournament.phases[0].battles) manager.recordWinner(tournament.id, adminToken, match.battleId!, match.mc1Id!);
    for (const match of tournament.phases[1].battles) manager.recordWinner(tournament.id, adminToken, match.battleId!, match.mc1Id!);
    for (const match of tournament.losersPhases![0].battles) manager.recordWinner(tournament.id, adminToken, match.battleId!, match.mc1Id!);
    for (const match of tournament.losersPhases![1].battles) manager.recordWinner(tournament.id, adminToken, match.battleId!, match.mc1Id!);
    const winnersFinal = tournament.phases[2].battles[0];
    manager.recordWinner(tournament.id, adminToken, winnersFinal.battleId!, winnersFinal.mc1Id!);
    manager.recordWinner(tournament.id, adminToken, tournament.losersPhases![2].battles[0].battleId!, tournament.losersPhases![2].battles[0].mc1Id!);
    manager.recordWinner(tournament.id, adminToken, tournament.losersPhases![3].battles[0].battleId!, tournament.losersPhases![3].battles[0].mc1Id!);

    expect(tournament.grandFinal?.battleId).toBeTruthy();
  });
});
