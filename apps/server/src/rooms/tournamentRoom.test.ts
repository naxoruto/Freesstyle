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
});
