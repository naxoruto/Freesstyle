import { describe, expect, it, afterAll } from "vitest";
import type { Tournament } from "@freestyle/shared";
import { TournamentPersistence } from "./tournamentPersistence";
import { prisma } from "../db/prisma";

function makeTournament(id: string): Tournament {
  return {
    id,
    name: "Torneo de prueba",
    status: "setup",
    participants: [],
    phases: [],
    currentPhaseIndex: 0,
    bracketMode: "random",
    type: "single_elimination",
    capacity: 8,
    suplentes: [],
    auditLog: [],
    createdAt: new Date().toISOString(),
  };
}

describe("TournamentPersistence", () => {
  const persistence = new TournamentPersistence();
  const ids = ["t-persist-1", "t-persist-2"];

  afterAll(async () => {
    await prisma.tournament.deleteMany({ where: { id: { in: ids } } });
  });

  it("persiste y recupera un torneo activo", async () => {
    await persistence.create(makeTournament(ids[0]));
    const active = await persistence.loadActive();
    expect(active.some((t) => t.id === ids[0])).toBe(true);
  });

  it("actualiza el estado de un torneo", async () => {
    await persistence.create(makeTournament(ids[1]));
    await persistence.update({ ...makeTournament(ids[1]), name: "Actualizado", status: "in_progress" });
    const active = await persistence.loadActive();
    const found = active.find((t) => t.id === ids[1]);
    expect(found?.name).toBe("Actualizado");
  });
});
