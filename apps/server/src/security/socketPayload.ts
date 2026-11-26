const roles = new Set(["participant", "judge", "admin", "host", "spectator"]);
const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128;
const optionalText = (value: unknown) => value === undefined || text(value);
const integer = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value);
const rubric = (value: unknown) => plain(value) && ["flow", "lirica", "ingenio", "presencia", "tecnica"].every(key => integer(value[key]) && Number(value[key]) >= 0 && Number(value[key]) <= 10);
const mode = (value: unknown) => plain(value)
  && ["clasico", "libre", "variado"].includes(String(value.mode))
  && ["1x1", "4x4", "8x8"].includes(String(value.format))
  && ["countdown", "manual"].includes(String(value.timerMode))
  && ["one_way", "round_trip"].includes(String(value.turnStructure))
  && ["rubrica", "patron", "free_vote", "room_vote"].includes(String(value.votingSystem))
  && ["facil", "medio", "dificil"].includes(String(value.difficulty))
  && integer(value.rounds) && integer(value.timePerTurn) && integer(value.entriesPerParticipant)
  && typeof value.liveControlEnabled === "boolean" && typeof value.showScoresToSpectators === "boolean"
  && (value.exhibition === undefined || typeof value.exhibition === "boolean")
  && optionalText(value.firstTurnParticipantId);

export function isSocketPayloadValid(event: string, payload: unknown): boolean {
  if (payload !== undefined && !plain(payload)) return false;
  const value = plain(payload) ? payload : {};
  switch (event) {
    case "battle:leave": case "battle:start": case "battle:complete_entry": return true;
    case "battle:join": return text(value.battleId) && plain(value.user) && text(value.user.id) && text(value.user.alias) && text(value.user.name)
      && (value.user.role === undefined || roles.has(String(value.user.role))) && optionalText(value.adminToken) && optionalText(value.inviteToken);
    case "battle:reconnect": return text(value.battleId) && text(value.sessionId);
    case "battle:next_phase": return optionalText(value.phaseToken);
    case "battle:resume": return value.action === "continue" || value.action === "restart_clock";
    case "battle:set_mode": return mode(value.mode);
    case "battle:set_local_participant": return (value.slot === 0 || value.slot === 1) && typeof value.alias === "string" && value.alias.length <= 40 && (value.expectedUserId === null || text(value.expectedUserId));
    case "battle:set_replica": return plain(value.config) && typeof value.config.enabled === "boolean" && integer(value.config.maxReplicas) && integer(value.config.tieRange) && mode(value.config.mode);
    case "battle:set_host": case "battle:grant_admin": case "battle:transfer_admin": case "battle:revoke_admin": return text(value.targetUserId);
    case "battle:change_role": return text(value.targetUserId) && roles.has(String(value.newRole));
    case "battle:revoke_role": return text(value.targetUserId) && roles.has(String(value.role));
    case "battle:create_invitation": return value.regenerate === undefined || typeof value.regenerate === "boolean";
    case "judge:vote_entry": return text(value.battleId) && integer(value.points);
    case "judge:vote_patron_extra": return text(value.battleId) && integer(value.mc1Extra) && integer(value.mc2Extra);
    case "judge:vote_rubric": return text(value.battleId) && integer(value.round) && text(value.mc1Id) && text(value.mc2Id) && rubric(value.mc1Scores) && rubric(value.mc2Scores);
    case "room:vote": case "judge:vote_free": return text(value.battleId) && text(value.votedForId);
    default: return false;
  }
}
