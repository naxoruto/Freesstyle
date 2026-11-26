import type { Tournament } from "@freestyle/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

export class TournamentPersistence {
  private readonly writes = new Map<string, Promise<unknown>>();

  private enqueue<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.writes.get(id) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.writes.set(id, current);
    const cleanup = () => {
      if (this.writes.get(id) === current) this.writes.delete(id);
    };
    void current.then(cleanup, cleanup);
    return current;
  }

  async create(tournament: Tournament, adminToken: string): Promise<void> {
    await this.enqueue(tournament.id, () => prisma.tournament.create({
      data: {
        id: tournament.id,
        name: tournament.name,
        logo: tournament.logo ?? null,
        organizer: tournament.organizer ?? null,
        type: tournament.type,
        capacity: tournament.capacity,
        status: tournament.status,
        adminToken,
        data: tournament as unknown as Prisma.InputJsonValue,
      },
    }));
  }

  async update(tournament: Tournament): Promise<void> {
    await this.enqueue(tournament.id, () => prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        name: tournament.name,
        logo: tournament.logo ?? null,
        organizer: tournament.organizer ?? null,
        type: tournament.type,
        capacity: tournament.capacity,
        status: tournament.status,
        data: tournament as unknown as Prisma.InputJsonValue,
      },
    }));
  }

  async loadActive(): Promise<{ tournament: Tournament; adminToken: string }[]> {
    const rows = await prisma.tournament.findMany({
      where: { status: { in: ["setup", "in_progress"] } },
    });
    return rows.map((row) => ({ tournament: row.data as unknown as Tournament, adminToken: row.adminToken }));
  }
}
