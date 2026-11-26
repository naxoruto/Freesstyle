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
  it("allows public enrollment until confirmation and reports the provisional place", async () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const created = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    const ids: string[] = [];
    for (const alias of ["A", "B", "C", "D", "E"]) {
      const participant = await manager.joinTournament(created.tournament.id, alias);
      expect(participant).not.toBeNull();
      ids.push(participant!.userId);
    }
    expect(created.tournament.participants).toHaveLength(4);
    expect(created.tournament.suplentes).toHaveLength(1);
    expect(manager.getRegistration(created.tournament.id, ids[4])?.status).toBe("suplente");
    expect(manager.getRegistration(created.tournament.id, ids[0])?.status).toBe("titular");
    manager.updateRules(created.tournament.id, created.adminToken, getDefaultModeConfig("libre"));
    expect(manager.getRegistration(created.tournament.id, ids[0])?.modeConfig.mode).toBe("libre");
    expect(manager.getRegistration(created.tournament.id, ids[0])?.rulesUpdatedAt).toBeTruthy();
    expect(await manager.joinTournament(created.tournament.id, " ")).toBeNull();
    expect(await manager.joinTournament(created.tournament.id, "x".repeat(41))).toBeNull();
    expect(manager.confirmParticipants(created.tournament.id, created.adminToken)).not.toBeNull();
    expect(await manager.joinTournament(created.tournament.id, "F")).toBeNull();
    expect(manager.getRegistration(created.tournament.id, ids[4])?.registrationClosed).toBe(true);
    manager.startTournament(created.tournament.id, created.adminToken, getDefaultModeConfig("clasico"));
    expect(await manager.joinTournament(created.tournament.id, "F")).toBeNull();
  });

  it("does not duplicate a public registration retried with the same identifier", async () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const created = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    const registrationId = "a1b2c3d4-e5f6-4abc-8def-0123456789ab";
    const first = await manager.joinTournament(created.tournament.id, "A", registrationId);
    const retry = await manager.joinTournament(created.tournament.id, "A", registrationId);
    expect(retry?.userId).toBe(first?.userId);
    expect(created.tournament.participants).toHaveLength(1);
    expect(await manager.joinTournament(created.tournament.id, "B", registrationId)).toBeNull();
  });

  it("rolls back a failed public enrollment and allows a retry", async () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const created = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    const persistence = (manager as unknown as { persistence: { update: (tournament: unknown) => Promise<void> } }).persistence;
    const update = vi.spyOn(persistence, "update").mockRejectedValueOnce(new Error("database unavailable"));
    const registrationId = "a1b2c3d4-e5f6-4abc-8def-0123456789ab";
    await expect(manager.joinTournament(created.tournament.id, "A", registrationId)).rejects.toThrow("database unavailable");
    expect(created.tournament.participants).toHaveLength(0);
    expect(await manager.joinTournament(created.tournament.id, "A", registrationId)).toMatchObject({ userId: registrationId });
    expect(created.tournament.participants).toHaveLength(1);
    update.mockRestore();
  });
  it("creates a tournament with all participants in one operation", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const result = manager.createTournamentWithParticipants("Copa", "manual", "single_elimination", ["A", "B", "C", "D"]);
    expect(result?.tournament.participants.map(participant => participant.alias)).toEqual(["A", "B", "C", "D"]);
    expect(result?.adminToken).toBeTruthy();
  });

  it("separa la carga inicial entre titulares y suplentes según la capacidad", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const result = manager.createTournamentWithParticipants("Copa", "manual", "single_elimination", ["A", "B", "C", "D", "E", "F", "G", "H"], { capacity: 4 });
    expect(result?.tournament.participants.map(participant => participant.alias)).toEqual(["A", "B", "C", "D"]);
    expect(result?.tournament.suplentes.map(participant => participant.alias)).toEqual(["E", "F", "G", "H"]);
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

  it("mantiene titulares y suplentes según la capacidad", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "random", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D", "E", "F"]) manager.addParticipant(tournament.id, adminToken, alias);
    expect(tournament.participants.map(participant => participant.alias)).toEqual(["A", "B", "C", "D"]);
    expect(tournament.suplentes.map(participant => participant.alias)).toEqual(["E", "F"]);
  });

  it("requiere confirmar el cupo antes de iniciar y cierra la inscripción pública", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C"]) manager.addParticipant(tournament.id, adminToken, alias);
    expect(manager.confirmParticipants(tournament.id, adminToken)).toBeNull();
    expect(manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"))).toBeNull();
    manager.addParticipant(tournament.id, adminToken, "D");
    expect(manager.confirmParticipants(tournament.id, "incorrecto")).toBeNull();
    expect(manager.confirmParticipants(tournament.id, adminToken)).toBe(tournament);
    expect(tournament.registrationClosed).toBe(true);
    expect(manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"))).toBe(tournament);
  });

  it("permite mover titulares y suplentes y quitar una inscripción con autorización", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D", "E"]) manager.addParticipant(tournament.id, adminToken, alias);
    const a = tournament.participants[0].userId;
    const e = tournament.suplentes[0].userId;
    expect(manager.moveParticipant(tournament.id, "incorrecto", e, "titular")).toBeNull();
    expect(manager.moveParticipant(tournament.id, adminToken, e, "titular")).toBe(tournament);
    expect(tournament.participants.map(participant => participant.alias)).toEqual(["A", "B", "C", "E"]);
    expect(tournament.suplentes.map(participant => participant.alias)).toEqual(["D"]);
    expect(manager.removeParticipant(tournament.id, adminToken, a)).toBe(tournament);
    expect(tournament.participants.map(participant => participant.alias)).toEqual(["B", "C", "E", "D"]);
    expect(manager.removeParticipant(tournament.id, adminToken, "desconocido")).toBeNull();
  });

  it("conserva las reglas elegidas y permite editarlas solo antes de iniciar", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const libre = getDefaultModeConfig("libre");
    const { tournament, adminToken } = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4, modeConfig: libre })!;
    expect(tournament.modeConfig?.mode).toBe("libre");
    const clasico = getDefaultModeConfig("clasico");
    expect(manager.updateRules(tournament.id, "incorrecto", clasico)).toBeNull();
    expect(manager.updateRules(tournament.id, adminToken, clasico)).toBe(tournament);
    expect(tournament.modeConfig?.mode).toBe("clasico");
    expect(tournament.rulesUpdatedAt).toBeTruthy();
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.confirmParticipants(tournament.id, adminToken);
    manager.sortParticipants(tournament.id, adminToken);
    manager.startTournament(tournament.id, adminToken, clasico);
    expect(manager.updateRules(tournament.id, adminToken, libre)).toBeNull();
    expect(tournament.phases[0].modeConfig.mode).toBe("clasico");
  });

  it("rechaza reglas incompletas y aplica el tiempo anunciado a la sala", () => {
    const battles = new BattleRoomManager();
    const manager = new TournamentRoomManager(battles);
    const rules = { ...getDefaultModeConfig("clasico"), timePerTurn: 45 };
    const created = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4, modeConfig: rules })!;
    expect(manager.updateRules(created.tournament.id, created.adminToken, { ...rules, rounds: undefined } as unknown as typeof rules)).toBeNull();
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(created.tournament.id, created.adminToken, alias);
    manager.confirmParticipants(created.tournament.id, created.adminToken);
    manager.sortParticipants(created.tournament.id, created.adminToken);
    manager.startTournament(created.tournament.id, created.adminToken, rules);
    expect(created.tournament.phases[0].modeConfig.timePerTurn).toBe(45);
    expect(battles.createBattle(rules).mode.timePerTurn).toBe(45);
  });

  it("deja una auditoría de las correcciones de inscripción y reglas", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D", "E"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.moveParticipant(tournament.id, adminToken, tournament.suplentes[0].userId, "titular");
    manager.removeParticipant(tournament.id, adminToken, tournament.suplentes[0].userId);
    manager.updateRules(tournament.id, adminToken, getDefaultModeConfig("libre"));
    manager.confirmParticipants(tournament.id, adminToken);
    expect(tournament.auditLog.map(entry => entry.action)).toEqual(["move", "remove", "rules", "confirm"]);
  });

  it("registra el sorteo y el reorden en la auditoría", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual", "single_elimination")!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);

    manager.confirmParticipants(tournament.id, adminToken);
    manager.sortParticipants(tournament.id, adminToken);
    expect(tournament.auditLog.some(entry => entry.action === "sort")).toBe(true);

    const ids = tournament.participants.map(participant => participant.userId);
    expect(manager.reorderParticipants(tournament.id, adminToken, [ids[1], ids[0], ids[2], ids[3]])).toBe(tournament);
    expect(tournament.participants.map(participant => participant.userId)).toEqual([ids[1], ids[0], ids[2], ids[3]]);
    expect(tournament.auditLog.some(entry => entry.action === "reorder")).toBe(true);
  });

  it("sustituye a un titular ausente por un suplente", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "random", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D", "E"]) manager.addParticipant(tournament.id, adminToken, alias);

    const absent = tournament.participants[0];
    manager.substituteParticipant(tournament.id, adminToken, absent.userId);
    expect(tournament.participants[0].alias).toBe("E");
    expect(tournament.suplentes).toHaveLength(0);
    expect(tournament.auditLog.some(entry => entry.action === "substitute")).toBe(true);
  });
  it("builds a bracket and advances winners to the final", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);

    manager.confirmParticipants(tournament.id, adminToken);

    tournament.drawOrder = tournament.participants.map(participant => participant.userId);
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
    const { tournament, adminToken } = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.confirmParticipants(tournament.id, adminToken);
    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    const match = tournament.phases[0].battles[0];

    expect(manager.recordBattleResult(match.battleId!, match.mc1Id!)).toBe(tournament);
    expect(match.winnerId).toBe(match.mc1Id);
  });

  it("reorders participants during setup and the bracket respects the new order", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    const [a, b, c, d] = tournament.participants;

    manager.confirmParticipants(tournament.id, adminToken);
    tournament.drawOrder = tournament.participants.map(participant => participant.userId);
    const reordered = manager.reorderParticipants(tournament.id, adminToken, [d.userId, a.userId, b.userId, c.userId]);
    expect(reordered).toBe(tournament);
    expect(tournament.participants.map(participant => participant.alias)).toEqual(["D", "A", "B", "C"]);

    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    const [first, second] = tournament.phases[0].battles;
    expect(first).toMatchObject({ mc1Id: d.userId, mc2Id: a.userId });
    expect(second).toMatchObject({ mc1Id: b.userId, mc2Id: c.userId });
  });

  it("sorts participants before starting and preserves the reviewed order when starting", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Sorteo", "random", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.confirmParticipants(tournament.id, adminToken);
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      expect(manager.sortParticipants(tournament.id, adminToken)).toBe(tournament);
    } finally {
      Math.random = originalRandom;
    }
    const reviewed = [...tournament.participants];
    expect(tournament.auditLog.at(-1)?.action).toBe("sort");
    const reversed = [...reviewed].reverse();
    expect(manager.reorderParticipants(tournament.id, adminToken, reversed.map(participant => participant.userId))).toBe(tournament);
    const finalOrder = [...tournament.participants];
    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    expect(tournament.participants.map(participant => participant.userId)).toEqual(finalOrder.map(participant => participant.userId));
    expect(tournament.phases[0].battles[0]).toMatchObject({ mc1Id: reversed[0].userId, mc2Id: reversed[1].userId });
    expect(tournament.auditLog.at(-1)?.action).toBe("reorder");
  });

  it("keeps the bracket open and its draw intact when a titular changes position", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "random", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D", "E"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.confirmParticipants(tournament.id, adminToken);
    manager.sortParticipants(tournament.id, adminToken);
    const drawn = [...tournament.participants];
    expect(manager.moveParticipant(tournament.id, adminToken, drawn[1].userId, "suplente")).toBe(tournament);
    expect(tournament.registrationClosed).toBe(true);
    expect(tournament.drawOrder).toEqual(tournament.participants.map(participant => participant.userId));
    expect(tournament.auditLog.some(entry => entry.action === "move")).toBe(true);
  });

  it("cancels a confirmed tournament when a titular is removed", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "random", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.confirmParticipants(tournament.id, adminToken);
    manager.sortParticipants(tournament.id, adminToken);
    expect(manager.removeParticipant(tournament.id, adminToken, tournament.participants[0].userId)).toBeNull();
    expect(manager.getTournament(tournament.id)).toBeUndefined();
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
    const { tournament, adminToken } = manager.createTournament("Copa", "manual", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.confirmParticipants(tournament.id, adminToken);
    manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"));
    const ids = tournament.participants.map(participant => participant.userId);

    expect(manager.reorderParticipants(tournament.id, adminToken, [...ids].reverse())).toBeNull();
    expect(tournament.participants.map(participant => participant.userId)).toEqual(ids);
  });

  it("clears the saved draw when titular membership changes", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "random", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D", "E"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.confirmParticipants(tournament.id, adminToken);
    manager.sortParticipants(tournament.id, adminToken);
    expect(tournament.drawOrder).toEqual(tournament.participants.map(participant => participant.userId));
    manager.removeParticipant(tournament.id, adminToken, tournament.participants[0].userId);
    expect(tournament.drawOrder).toBeUndefined();
    expect(tournament.registrationClosed).toBe(true);
  });

  it("requires confirmation and a full roster before drawing", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Copa", "random", "single_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C"]) manager.addParticipant(tournament.id, adminToken, alias);
    expect(manager.sortParticipants(tournament.id, adminToken)).toBeNull();
    manager.addParticipant(tournament.id, adminToken, "D");
    expect(manager.sortParticipants(tournament.id, adminToken)).toBeNull();
    manager.confirmParticipants(tournament.id, adminToken);
    expect(manager.sortParticipants(tournament.id, adminToken)).toBe(tournament);
    const drawOrder = [...tournament.drawOrder!];
    manager.addParticipant(tournament.id, adminToken, "Suplente");
    expect(tournament.registrationClosed).toBe(true);
    expect(tournament.drawOrder).toEqual(drawOrder);
    expect(tournament.suplentes.map(participant => participant.alias)).toContain("Suplente");
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
    const { tournament, adminToken } = manager.createTournament("Repesca", "manual", "double_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    const [a, b, c, d] = tournament.participants;

    manager.confirmParticipants(tournament.id, adminToken);
    tournament.drawOrder = tournament.participants.map(participant => participant.userId);
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
    const { tournament, adminToken } = manager.createTournament("Repesca", "manual", "double_elimination", { capacity: 4 })!;
    for (const alias of ["A", "B", "C", "D"]) manager.addParticipant(tournament.id, adminToken, alias);
    manager.confirmParticipants(tournament.id, adminToken);
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
      const { tournament, adminToken } = manager.createTournament(`Repesca ${count}`, "manual", "double_elimination", { capacity: count })!;
      for (let index = 0; index < count; index++) manager.addParticipant(tournament.id, adminToken, `MC ${index + 1}`);
      manager.confirmParticipants(tournament.id, adminToken);
      manager.sortParticipants(tournament.id, adminToken);
      expect(manager.startTournament(tournament.id, adminToken, getDefaultModeConfig("clasico"))).toBe(tournament);
      expect(tournament.losersPhases?.map(phase => phase.battles.length)).toEqual(expected);
    }
  });

  it("advances an 8-player loser bracket into the grand final", () => {
    const manager = new TournamentRoomManager(new BattleRoomManager());
    const { tournament, adminToken } = manager.createTournament("Repesca 8", "manual", "double_elimination")!;
    for (let index = 0; index < 8; index++) manager.addParticipant(tournament.id, adminToken, `MC ${index + 1}`);
    manager.confirmParticipants(tournament.id, adminToken);
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
