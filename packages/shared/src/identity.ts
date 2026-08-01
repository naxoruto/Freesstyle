import type { UserRole } from "./types";

/**
 * Identidad estable de un usuario dentro de una sala.
 * Un mismo usuario físico puede tener múltiples roles acumulados,
 * pero comparte un único `sessionId` por sala.
 */
export interface RoomIdentity {
  userId: string;
  alias: string;
  roles: UserRole[];
  joinedAt: string;
}

/**
 * Sesión de sala con expiración.
 *
 * - `sessionId`: token opaco que identifica esta sesión. Se emite al unirse.
 * - `reconnectWindowMs`: ventana de reconexión desde la desconexión.
 *   Pasado ese tiempo la sesión se considera expirada y se limpia.
 * - `disconnectedAt`: ISO timestamp de la última desconexión (null si está conectado).
 */
export interface RoomSession {
  sessionId: string;
  roomId: string;
  identity: RoomIdentity;
  connected: boolean;
  disconnectedAt: string | null;
  createdAt: string;
  expiresAt: string;
  reconnectWindowMs: number;
}

export const DEFAULT_RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Invitación de un solo uso para unirse a una sala con un rol específico.
 *
 * - `token`: opaco, se incluye en la URL de invitación.
 * - `maxUses`: normalmente 1. Puede ser mayor para invitaciones de audiencia.
 * - `usedCount`: cuántas veces se ha consumido ya.
 * - `expiresAt`: después de esta fecha la invitación es inválida.
 *
 * Las invitaciones NUNCA deben contener `adminToken` ni credenciales.
 */
export interface RoomInvitation {
  token: string;
  roomId: string;
  role: UserRole;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  expiresAt: string;
  createdBy: string; // userId del admin que la generó
}

export const DEFAULT_INVITATION_MAX_USES = 1;
export const DEFAULT_INVITATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Política de exposición en URLs — DOCUMENTACIÓN CANÓNICA.
 *
 * PERMITIDO en query params o path params:
 *   - `roomId` / `battleId` (identificador público de sala)
 *   - `invite`  (token de invitación de un solo uso)
 *
 * PROHIBIDO en cualquier URL pública:
 *   - `adminToken`
 *   - `sessionId`
 *   - `role`, `alias`, `alsoAs`
 *   - Cualquier credencial o dato personal
 *
 * Las operaciones administrativas siempre se validan en el servidor.
 * El rol declarado por el navegador nunca es la única autorización.
 */

export function isSessionExpired(session: RoomSession, now: number = Date.now()): boolean {
  return now > new Date(session.expiresAt).getTime();
}

export function isSessionInReconnectWindow(session: RoomSession, now: number = Date.now()): boolean {
  if (session.connected) return true;
  if (!session.disconnectedAt) return false;
  const disconnectedMs = now - new Date(session.disconnectedAt).getTime();
  return disconnectedMs <= session.reconnectWindowMs;
}

export function isInvitationValid(invitation: RoomInvitation, now: number = Date.now()): boolean {
  return invitation.usedCount < invitation.maxUses && now <= new Date(invitation.expiresAt).getTime();
}

export function consumeInvitation(invitation: RoomInvitation): boolean {
  if (!isInvitationValid(invitation)) return false;
  invitation.usedCount++;
  return true;
}

export function markSessionDisconnected(session: RoomSession): void {
  session.connected = false;
  session.disconnectedAt = new Date().toISOString();
}

export function markSessionReconnected(session: RoomSession): void {
  session.connected = true;
  session.disconnectedAt = null;
}
