import { v4 as uuid } from "uuid";
import type { BattleModeConfig, ReplicaConfig, Tournament, TournamentCapacity, TournamentPhase, TournamentType } from "@freestyle/shared";
import { BattleRoomManager } from "./battleRoom";
import { generateShortId } from "./id";
import { TournamentPersistence } from "./tournamentPersistence";

function phaseName(size: number): string {
  if (size === 2) return "Final";
  if (size === 4) return "Semifinal";
  if (size === 8) return "Cuartos de final";
  if (size === 16) return "Octavos de final";
  return `Ronda de ${size}`;
}

export class TournamentRoomManager {
  private tournaments = new Map<string, Tournament>();
  private adminTokens = new Map<string, string>();
  private persistence = new TournamentPersistence();

  constructor(private battleManager: BattleRoomManager) {}

  createTournamentWithParticipants(name: string, bracketMode: "manual" | "random", type: TournamentType, aliases: unknown, options?: { logo?: string; organizer?: string; capacity?: number }): { tournament: Tournament; adminToken: string } | null {
    if (!Array.isArray(aliases) || aliases.length < 4 || aliases.length > 128 || (aliases.length & (aliases.length - 1)) !== 0) return null;
    if (!aliases.every(alias => typeof alias === "string" && alias.trim().length > 0 && alias.trim().length <= 40)) return null;
    const created = this.createTournament(name, bracketMode, type, options);
    if (!created) return null;
    created.tournament.participants = aliases.map(alias => ({ userId: uuid(), alias: (alias as string).trim(), eliminated: false }));
    return created;
  }

  createTournament(name: string, bracketMode: "manual" | "random", type: TournamentType = "single_elimination", options?: { logo?: string; organizer?: string; capacity?: number }): { tournament: Tournament; adminToken: string } | null {
    const capacity = options?.capacity ?? 8;
    if (![4, 8, 16].includes(capacity)) return null;
    if (type === "king_of_the_hill") return null;
    const id = generateShortId();
    const adminToken = uuid();
    const tournament: Tournament = {
      id,
      name: name.trim(),
      status: "setup",
      participants: [],
      phases: [],
      currentPhaseIndex: 0,
      bracketMode,
      type,
      logo: options?.logo,
      organizer: options?.organizer,
      capacity: capacity as TournamentCapacity,
      suplentes: [],
      auditLog: [],
      createdAt: new Date().toISOString(),
    };
    this.tournaments.set(id, tournament);
    this.adminTokens.set(id, adminToken);
    void this.persistence.create(tournament).catch(error => console.error("No se pudo guardar el torneo", error));
    return { tournament, adminToken };
  }

  addParticipant(tournamentId: string, adminToken: string, alias: string): Tournament | null {
    const tournament = this.authorize(tournamentId, adminToken);
    if (!tournament || tournament.status !== "setup" || !alias.trim()) return null;
    const participant = { userId: uuid(), alias: alias.trim(), eliminated: false };
    if (tournament.participants.length < tournament.capacity) {
      tournament.participants.push(participant);
    } else {
      tournament.suplentes.push(participant);
    }
    this.persist(tournament);
    return tournament;
  }

  sortParticipants(tournamentId: string, adminToken: string): Tournament | null {
    const tournament = this.authorize(tournamentId, adminToken);
    if (!tournament || tournament.status !== "setup") return null;
    const participants = [...tournament.participants];
    for (let index = participants.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [participants[index], participants[swapIndex]] = [participants[swapIndex], participants[index]];
    }
    tournament.participants = participants;
    tournament.auditLog.push({ at: new Date().toISOString(), actorId: "admin", action: "sort", detail: "Sorteó el orden de los titulares" });
    this.persist(tournament);
    return tournament;
  }

  reorderParticipants(tournamentId: string, adminToken: string, orderedIds: string[]): Tournament | null {
    const tournament = this.authorize(tournamentId, adminToken);
    if (!tournament || tournament.status !== "setup" || !Array.isArray(orderedIds)) return null;
    const current = tournament.participants;
    if (orderedIds.length !== current.length || new Set(orderedIds).size !== current.length) return null;
    const byId = new Map(current.map(participant => [participant.userId, participant]));
    if (!orderedIds.every(id => byId.has(id))) return null;
    tournament.participants = orderedIds.map(id => byId.get(id)!);
    tournament.auditLog.push({ at: new Date().toISOString(), actorId: "admin", action: "reorder", detail: "Reordenó los titulares del cuadro" });
    this.persist(tournament);
    return tournament;
  }

  startTournament(
    tournamentId: string,
    adminToken: string,
    modeConfig: BattleModeConfig,
    replicaConfig?: ReplicaConfig,
  ): Tournament | null {
    const tournament = this.authorize(tournamentId, adminToken);
    if (!tournament || tournament.status !== "setup") return null;
    const participantCount = tournament.participants.length;
    if (participantCount < 4 || (participantCount & (participantCount - 1)) !== 0) return null;

    const participants = [...tournament.participants];
    if (tournament.bracketMode === "random") {
      for (let index = participants.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [participants[index], participants[swapIndex]] = [participants[swapIndex], participants[index]];
      }
    }

    const phases: TournamentPhase[] = [];
    if (tournament.type === "king_of_the_hill") {
      const roomVoteMode = { ...modeConfig, votingSystem: "room_vote" as const };
      phases.push({
        name: "Rey de la pista",
        modeConfig: roomVoteMode,
        replicaConfig,
        battles: [{
          mc1Id: participants[0].userId,
          mc2Id: participants[1].userId,
          battleId: this.battleManager.createBattle(roomVoteMode).id,
        }],
      });
      tournament.participants = participants;
    } else {
      for (let size = participantCount; size >= 2; size /= 2) {
        phases.push({
          name: phaseName(size),
          modeConfig: { ...modeConfig },
          replicaConfig,
          battles: Array.from({ length: size / 2 }, () => ({})),
        });
      }
      phases[0].battles.forEach((match, index) => {
        match.mc1Id = participants[index * 2].userId;
        match.mc2Id = participants[index * 2 + 1].userId;
        match.battleId = this.battleManager.createBattle(modeConfig).id;
      });
    }

    tournament.phases = phases;
    tournament.status = "in_progress";

    if (tournament.type === "double_elimination") {
      const winnerRoundCount = phases.length;
      tournament.losersPhases = [];
      for (let round = 0; round < (winnerRoundCount - 1) * 2; round++) {
        const size = Math.max(1, participantCount / 2 ** (Math.floor(round / 2) + 2));
        tournament.losersPhases.push({
          name: `Repesca · Ronda ${round + 1}`,
          modeConfig: { ...modeConfig },
          replicaConfig,
          battles: Array.from({ length: size }, () => ({})),
        });
      }
      tournament.grandFinal = {};
    }

    if (tournament.type === "with_third_place" && phases.length >= 2) {
      tournament.thirdPlaceMatch = {};
    }

    this.persist(tournament);
    return tournament;
  }

  recordWinner(tournamentId: string, adminToken: string, battleId: string, winnerId: string): Tournament | null {
    const tournament = this.authorize(tournamentId, adminToken);
    if (!tournament || tournament.status !== "in_progress") return null;
    const result = this.advanceWinner(tournament, battleId, winnerId);
    if (result) this.persist(tournament);
    return result;
  }

  recordBattleResult(battleId: string, winnerId: string): Tournament | null {
    for (const tournament of this.tournaments.values()) {
      if (tournament.status !== "in_progress") continue;
      // Check all phases (not just current) for the battle
      const found = tournament.phases.some(phase =>
        phase.battles.some(match => match.battleId === battleId && !match.winnerId)
      ) || tournament.losersPhases?.some(phase => phase.battles.some(match => match.battleId === battleId && !match.winnerId))
        || (tournament.thirdPlaceMatch?.battleId === battleId && !tournament.thirdPlaceMatch.winnerId)
        || (tournament.grandFinal?.battleId === battleId && !tournament.grandFinal.winnerId)
        || (tournament.grandFinalReset?.battleId === battleId && !tournament.grandFinalReset.winnerId);
      if (found) {
        const result = this.advanceWinner(tournament, battleId, winnerId);
        if (result) this.persist(tournament);
        return result;
      }
    }
    return null;
  }

  private advanceWinner(tournament: Tournament, battleId: string, winnerId: string): Tournament | null {
    if (tournament.type === "double_elimination") return this.advanceDoubleElimination(tournament, battleId, winnerId);
    // Third place match — prevent double registration
    if (tournament.thirdPlaceMatch?.battleId === battleId) {
      if (tournament.thirdPlaceMatch.winnerId) return null;
      if (winnerId !== tournament.thirdPlaceMatch.mc1Id && winnerId !== tournament.thirdPlaceMatch.mc2Id) return null;
      tournament.thirdPlaceMatch.winnerId = winnerId;
      return tournament;
    }

    const phase = tournament.phases[tournament.currentPhaseIndex];
    const matchIndex = phase?.battles.findIndex(match => match.battleId === battleId) ?? -1;
    if (!phase || matchIndex < 0) return null;
    const match = phase.battles[matchIndex];
    if (match.winnerId) return null;
    if (winnerId !== match.mc1Id && winnerId !== match.mc2Id) return null;
    match.winnerId = winnerId;
    const loserId = winnerId === match.mc1Id ? match.mc2Id : match.mc1Id;
    const loser = tournament.participants.find(participant => participant.userId === loserId);
    if (loser) loser.eliminated = true;

    if (tournament.type === "king_of_the_hill") {
      const nextChallenger = tournament.participants[phase.battles.length + 1];
      if (!nextChallenger) {
        tournament.status = "finished";
        tournament.winnerId = winnerId;
        return tournament;
      }
      phase.battles.push({
        mc1Id: winnerId,
        mc2Id: nextChallenger.userId,
        battleId: this.battleManager.createBattle(phase.modeConfig).id,
      });
      return tournament;
    }

    if (tournament.currentPhaseIndex === tournament.phases.length - 1) {
      // Generate third place match if semifinal losers have been identified
      if (tournament.type === "with_third_place" && tournament.phases.length >= 2) {
        const semiPhase = tournament.phases[0];
        const semiLosers = semiPhase.battles
          .map((b, i) => {
            const loserId = b.winnerId === b.mc1Id ? b.mc2Id : b.winnerId === b.mc2Id ? b.mc1Id : undefined;
            return loserId;
          })
          .filter(Boolean) as string[];
        if (semiLosers.length === 2 && tournament.thirdPlaceMatch && !tournament.thirdPlaceMatch.battleId) {
          tournament.thirdPlaceMatch.mc1Id = semiLosers[0];
          tournament.thirdPlaceMatch.mc2Id = semiLosers[1];
          const mode = tournament.phases[0].modeConfig;
          tournament.thirdPlaceMatch.battleId = this.battleManager.createBattle(mode).id;
        }
      }
      tournament.status = "finished";
      tournament.winnerId = winnerId;
      return tournament;
    }

    const nextPhase = tournament.phases[tournament.currentPhaseIndex + 1];
    const nextMatch = nextPhase.battles[Math.floor(matchIndex / 2)];
    if (matchIndex % 2 === 0) nextMatch.mc1Id = winnerId;
    else nextMatch.mc2Id = winnerId;
    if (nextMatch.mc1Id && nextMatch.mc2Id && !nextMatch.battleId) {
      nextMatch.battleId = this.battleManager.createBattle(nextPhase.modeConfig).id;
    }
    if (phase.battles.every(current => current.winnerId)) tournament.currentPhaseIndex++;
    return tournament;
  }

  private advanceDoubleElimination(tournament: Tournament, battleId: string, winnerId: string): Tournament | null {
    const winnersPhase = tournament.phases.find(phase => phase.battles.some(match => match.battleId === battleId));
    const losersPhase = tournament.losersPhases?.find(phase => phase.battles.some(match => match.battleId === battleId));
    const grandFinal = tournament.grandFinal?.battleId === battleId ? tournament.grandFinal : undefined;
    const resetFinal = tournament.grandFinalReset?.battleId === battleId ? tournament.grandFinalReset : undefined;
    const match = winnersPhase?.battles.find(candidate => candidate.battleId === battleId)
      ?? losersPhase?.battles.find(candidate => candidate.battleId === battleId)
      ?? grandFinal
      ?? resetFinal;
    if (!match || match.winnerId || (winnerId !== match.mc1Id && winnerId !== match.mc2Id)) return null;

    match.winnerId = winnerId;
    const loserId = winnerId === match.mc1Id ? match.mc2Id : match.mc1Id;
    const loser = tournament.participants.find(participant => participant.userId === loserId);

    if (resetFinal) {
      tournament.status = "finished";
      tournament.winnerId = winnerId;
      if (loser) loser.eliminated = true;
      return tournament;
    }

    if (grandFinal) {
      if (winnerId === grandFinal.mc1Id) {
        tournament.status = "finished";
        tournament.winnerId = winnerId;
        if (loser) loser.eliminated = true;
      } else {
        tournament.grandFinalReset = {
          mc1Id: grandFinal.mc1Id,
          mc2Id: grandFinal.mc2Id,
          battleId: this.battleManager.createBattle(tournament.phases[0].modeConfig).id,
        };
      }
      return tournament;
    }

    if (winnersPhase) {
      const nextPhase = tournament.phases[tournament.phases.indexOf(winnersPhase) + 1];
      if (nextPhase) {
        const matchIndex = winnersPhase.battles.indexOf(match);
        const nextMatch = nextPhase.battles[Math.floor(matchIndex / 2)];
        if (matchIndex % 2 === 0) nextMatch.mc1Id = winnerId;
        else nextMatch.mc2Id = winnerId;
        if (nextMatch.mc1Id && nextMatch.mc2Id && !nextMatch.battleId) nextMatch.battleId = this.battleManager.createBattle(nextPhase.modeConfig).id;
      }
    }

    if (loser && losersPhase) loser.eliminated = true;
    this.prepareDoubleElimination(tournament);
    return tournament;
  }

  private prepareDoubleElimination(tournament: Tournament): void {
    const losersPhases = tournament.losersPhases;
    if (!losersPhases) return;
    const loserOf = (match: { mc1Id?: string; mc2Id?: string; winnerId?: string }): string | undefined => {
      if (!match.winnerId) return undefined;
      return match.winnerId === match.mc1Id ? match.mc2Id : match.mc1Id;
    };
    const winnerOf = (match: { winnerId?: string }): string | undefined => match.winnerId;

    for (let phaseIndex = 0; phaseIndex < losersPhases.length; phaseIndex++) {
      const phase = losersPhases[phaseIndex];
      const ids: (string | undefined)[] = [];
      if (phaseIndex === 0) {
        ids.push(...tournament.phases[0].battles.map(loserOf));
      } else if (phaseIndex % 2 === 0) {
        ids.push(...losersPhases[phaseIndex - 1].battles.map(winnerOf));
      } else {
        const winnersFromPrevious = losersPhases[phaseIndex - 1].battles.map(winnerOf);
        const winnersPhaseIndex = (phaseIndex + 1) / 2;
        const losersFromWinners = tournament.phases[winnersPhaseIndex]?.battles.map(loserOf) ?? [];
        for (let index = 0; index < Math.max(winnersFromPrevious.length, losersFromWinners.length); index++) {
          ids.push(winnersFromPrevious[index], losersFromWinners[index]);
        }
      }

      if (ids.length < phase.battles.length * 2 || ids.some(id => !id)) continue;
      for (let index = 0; index < phase.battles.length; index++) {
        const match = phase.battles[index];
        if (match.battleId) continue;
        match.mc1Id = ids[index * 2];
        match.mc2Id = ids[index * 2 + 1];
        match.battleId = this.battleManager.createBattle(phase.modeConfig).id;
      }
    }

    const finalWinners = tournament.phases.at(-1)?.battles[0]?.winnerId;
    const finalLoserWinner = losersPhases.at(-1)?.battles[0]?.winnerId;
    if (finalWinners && finalLoserWinner && !tournament.grandFinal?.battleId) {
      tournament.grandFinal = {
        mc1Id: finalWinners,
        mc2Id: finalLoserWinner,
        battleId: this.battleManager.createBattle(tournament.phases[0].modeConfig).id,
      };
    }
  }

  getTournament(tournamentId: string): Tournament | undefined {
    return this.tournaments.get(tournamentId.toLowerCase());
  }

  getBattleAdminToken(tournamentId: string, adminToken: string, battleId: string): string | null {
    const tournament = this.authorize(tournamentId, adminToken);
    const belongsToTournament = tournament && (
      tournament.phases.some(phase => phase.battles.some(match => match.battleId === battleId))
      || tournament.losersPhases?.some(phase => phase.battles.some(match => match.battleId === battleId))
      || tournament.grandFinal?.battleId === battleId
      || tournament.grandFinalReset?.battleId === battleId
    );
    if (!belongsToTournament) return null;
    return this.battleManager.getAdminToken(battleId) ?? null;
  }

  private persist(tournament: Tournament): void {
    void this.persistence.update(tournament).catch(error => {
      console.error("No se pudo guardar el torneo", error);
    });
  }

  private authorize(tournamentId: string, adminToken: string): Tournament | null {
    const id = tournamentId.toLowerCase();
    if (this.adminTokens.get(id) !== adminToken) return null;
    return this.tournaments.get(id) ?? null;
  }
}
