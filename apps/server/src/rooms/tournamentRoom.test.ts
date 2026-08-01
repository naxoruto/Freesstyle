import { describe, expect, it } from "vitest";
import { getDefaultModeConfig } from "../modes/modes";
import { BattleRoomManager } from "./battleRoom";
import { TournamentRoomManager } from "./tournamentRoom";

describe("TournamentRoomManager", () => {
  it("builds a bracket and advances winners to the final", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual");
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
    const { tournament, adminToken } = manager.createTournament("Copa", "manual");
    for (const alias of ["A", "B", "C"]) manager.addParticipant(tournament.id, adminToken, alias);
    expect(manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"))).toBeNull();
  });

  it("accepts automatic results from completed battle rooms", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual");
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    const match = tournament.phases[0].battles[0];

    expect(manager.recordBattleResult(match.battleId!, match.mc1Id!)).toBe(tournament);
    expect(match.winnerId).toBe(match.mc1Id);
  });

  it("reorders participants during setup and the bracket respects the new order", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual");
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
    const { tournament, adminToken } = manager.createTournament("Copa", "manual");
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    const ids = tournament.participants.map(participant => participant.userId);

    expect(manager.reorderParticipants(tournament.id, "invalid-token", [...ids].reverse())).toBeNull();
    expect(tournament.participants.map(participant => participant.userId)).toEqual(ids);
  });

  it("rejects reorder once the tournament has started", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual");
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    const ids = tournament.participants.map(participant => participant.userId);

    expect(manager.reorderParticipants(tournament.id, adminToken, [...ids].reverse())).toBeNull();
    expect(tournament.participants.map(participant => participant.userId)).toEqual(ids);
  });

  it("rejects reorder with missing, duplicate or unknown ids", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual");
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    const ids = tournament.participants.map(participant => participant.userId);

    expect(manager.reorderParticipants(tournament.id, adminToken, ids.slice(1))).toBeNull();
    expect(manager.reorderParticipants(tournament.id, adminToken, [ids[0], ids[0], ids[1], ids[2]])).toBeNull();
    expect(manager.reorderParticipants(tournament.id, adminToken, [...ids.slice(1), "unknown-id"])).toBeNull();
    expect(tournament.participants.map(participant => participant.userId)).toEqual(ids);
  });
});
