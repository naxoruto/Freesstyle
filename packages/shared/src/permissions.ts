import type { UserRole } from "./types";

export const ROLE_LIMITS: Record<UserRole, number> = {
  admin: 2,
  host: 1,
  judge: 5,
  participant: 2,
  spectator: Number.POSITIVE_INFINITY,
} as const;

export const VALID_JUDGE_COUNTS = new Set([1, 3, 5]);

export type BattlePrivilege =
  | "configure_room"
  | "start_battle"
  | "advance_phase"
  | "complete_entry"
  | "configure_replica"
  | "transfer_host"
  | "vote"
  | "join_room";

const PRIVILEGE_MATRIX: Record<BattlePrivilege, UserRole[]> = {
  configure_room: ["admin"],
  start_battle: ["admin"],
  advance_phase: ["admin", "host"],
  complete_entry: ["admin", "host"],
  configure_replica: ["admin"],
  transfer_host: ["admin", "host"],
  vote: ["judge"],
  join_room: ["admin", "host", "judge", "participant", "spectator"],
};

export function canPerform(action: BattlePrivilege, roles: UserRole[]): boolean {
  return roles.some((role) => PRIVILEGE_MATRIX[action].includes(role));
}

export function countRole(currentUsers: UserRole[], role: UserRole): number {
  return currentUsers.filter((r) => r === role).length;
}

export function canJoinAsRole(
  currentCount: number,
  role: UserRole,
): boolean {
  return currentCount < ROLE_LIMITS[role];
}
