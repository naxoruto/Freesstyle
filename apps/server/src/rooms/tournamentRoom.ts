import { v4 as uuid } from "uuid";
import type { BattleModeConfig, ReplicaConfig, Tournament, TournamentPhase } from "@freestyle/shared";
import { BattleRoomManager } from "./battleRoom";

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

  constructor(private battleManager: BattleRoomManager) {}

  createTournament(name: string, bracketMode: "manual" | "random"): { tournament: Tournament; adminToken: string } {
    const id = uuid().slice(0, 8);
    const adminToken = uuid();
    const tournament: Tournament = {
      id,
      name: name.trim(),
      status: "setup",
      participants: [],
      phases: [],
      currentPhaseIndex: 0,
      bracketMode,
      createdAt: new Date().toISOString(),
    };
    this.tournaments.set(id, tournament);
    this.adminTokens.set(id, adminToken);
    return { tournament, adminToken };
  }

  addParticipant(tournamentId: string, adminToken: string, alias: string): Tournament | null {
    const tournament = this.authorize(tournamentId, adminToken);
    if (!tournament || tournament.status !== "setup" || !alias.trim()) return null;
    tournament.participants.push({ userId: uuid(), alias: alias.trim(), eliminated: false });
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

    tournament.phases = phases;
    tournament.status = "in_progress";
    return tournament;
  }

  recordWinner(tournamentId: string, adminToken: string, battleId: string, winnerId: string): Tournament | null {
    const tournament = this.authorize(tournamentId, adminToken);
    if (!tournament || tournament.status !== "in_progress") return null;
    return this.advanceWinner(tournament, battleId, winnerId);
  }

  recordBattleResult(battleId: string, winnerId: string): Tournament | null {
    for (const tournament of this.tournaments.values()) {
      if (tournament.status !== "in_progress") continue;
      if (tournament.phases.some(phase => phase.battles.some(match => match.battleId === battleId))) {
        return this.advanceWinner(tournament, battleId, winnerId);
      }
    }
    return null;
  }

  private advanceWinner(tournament: Tournament, battleId: string, winnerId: string): Tournament | null {
    const phase = tournament.phases[tournament.currentPhaseIndex];
    const matchIndex = phase?.battles.findIndex(match => match.battleId === battleId) ?? -1;
    if (!phase || matchIndex < 0) return null;
    const match = phase.battles[matchIndex];
    if (winnerId !== match.mc1Id && winnerId !== match.mc2Id) return null;
    match.winnerId = winnerId;
    const loserId = winnerId === match.mc1Id ? match.mc2Id : match.mc1Id;
    const loser = tournament.participants.find(participant => participant.userId === loserId);
    if (loser) loser.eliminated = true;

    if (tournament.currentPhaseIndex === tournament.phases.length - 1) {
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

  getTournament(tournamentId: string): Tournament | undefined {
    return this.tournaments.get(tournamentId.toLowerCase());
  }

  getBattleAdminToken(tournamentId: string, adminToken: string, battleId: string): string | null {
    const tournament = this.authorize(tournamentId, adminToken);
    if (!tournament || !tournament.phases.some(phase => phase.battles.some(match => match.battleId === battleId))) return null;
    return this.battleManager.getAdminToken(battleId) ?? null;
  }

  private authorize(tournamentId: string, adminToken: string): Tournament | null {
    const id = tournamentId.toLowerCase();
    if (this.adminTokens.get(id) !== adminToken) return null;
    return this.tournaments.get(id) ?? null;
  }
}
