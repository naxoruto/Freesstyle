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

/** Espacio de IDs reservado al servidor para MC presenciales, sin sesión digital. */
export const LOCAL_PARTICIPANT_PREFIX = "local:";
export function isLocalParticipantId(userId: string): boolean {
  return userId.startsWith(LOCAL_PARTICIPANT_PREFIX);
}

/** Invitación reutilizable de sala. Regenerarla revoca el token anterior. */
export interface RoomInvitation {
  token: string;
  roomId: string;
  createdAt: string;
  createdBy: string; // userId del admin que la generó
}

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
  return Boolean(invitation.token && invitation.roomId && new Date(invitation.createdAt).getTime() <= now);
}

export function markSessionDisconnected(session: RoomSession): void {
  session.connected = false;
  session.disconnectedAt = new Date().toISOString();
}

export function markSessionReconnected(session: RoomSession): void {
  session.connected = true;
  session.disconnectedAt = null;
}
