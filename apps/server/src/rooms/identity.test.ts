import { describe, expect, it } from "vitest";
import type { RoomInvitation, RoomSession } from "@freestyle/shared";
import {
  DEFAULT_RECONNECT_WINDOW_MS,
  isInvitationValid,
  isSessionExpired,
  isSessionInReconnectWindow,
  markSessionDisconnected,
  markSessionReconnected,
} from "@freestyle/shared";

function makeSession(overrides: Partial<RoomSession> = {}): RoomSession {
  const now = Date.now();
  return {
    sessionId: "sess-001",
    roomId: "battle-abc",
    identity: { userId: "user-1", alias: "MC Test", roles: ["participant"], joinedAt: new Date(now).toISOString() },
    connected: true,
    disconnectedAt: null,
    createdAt: new Date(now - 3600000).toISOString(),
    expiresAt: new Date(now + 3600000).toISOString(),
    reconnectWindowMs: DEFAULT_RECONNECT_WINDOW_MS,
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<RoomInvitation> = {}): RoomInvitation {
  const now = Date.now();
  return {
    token: "invite-abc123",
    roomId: "battle-abc",
    createdAt: new Date(now).toISOString(),
    createdBy: "admin-1",
    ...overrides,
  };
}

describe("RoomSession", () => {
  describe("isSessionExpired", () => {
    it("returns false for a fresh session", () => {
      expect(isSessionExpired(makeSession())).toBe(false);
    });

    it("returns true when expiration is in the past", () => {
      const past = Date.now() - 10000;
      const session = makeSession({ expiresAt: new Date(past).toISOString() });
      expect(isSessionExpired(session)).toBe(true);
    });

    it("returns false exactly at expiration boundary", () => {
      const now = Date.now();
      const session = makeSession({ expiresAt: new Date(now).toISOString() });
      expect(isSessionExpired(session, now)).toBe(false);
    });
  });

  describe("isSessionInReconnectWindow", () => {
    it("returns true when connected", () => {
      expect(isSessionInReconnectWindow(makeSession({ connected: true }))).toBe(true);
    });

    it("returns true shortly after disconnection", () => {
      const now = Date.now();
      const session = makeSession({
        connected: false,
        disconnectedAt: new Date(now - 60000).toISOString(), // 1 min ago
        reconnectWindowMs: DEFAULT_RECONNECT_WINDOW_MS,
      });
      expect(isSessionInReconnectWindow(session, now)).toBe(true);
    });

    it("returns false after reconnect window expires", () => {
      const now = Date.now();
      const session = makeSession({
        connected: false,
        disconnectedAt: new Date(now - DEFAULT_RECONNECT_WINDOW_MS - 1).toISOString(),
        reconnectWindowMs: DEFAULT_RECONNECT_WINDOW_MS,
      });
      expect(isSessionInReconnectWindow(session, now)).toBe(false);
    });

    it("returns false when never connected and no disconnectedAt", () => {
      const session = makeSession({ connected: false, disconnectedAt: null });
      expect(isSessionInReconnectWindow(session)).toBe(false);
    });
  });

  describe("markSessionDisconnected", () => {
    it("sets connected to false and records disconnectedAt", () => {
      const session = makeSession();
      markSessionDisconnected(session);
      expect(session.connected).toBe(false);
      expect(session.disconnectedAt).toBeTruthy();
    });
  });

  describe("markSessionReconnected", () => {
    it("sets connected to true and clears disconnectedAt", () => {
      const session = makeSession({ connected: false, disconnectedAt: new Date().toISOString() });
      markSessionReconnected(session);
      expect(session.connected).toBe(true);
      expect(session.disconnectedAt).toBeNull();
    });
  });
});

describe("RoomInvitation", () => {
  describe("isInvitationValid", () => {
    it("returns true for a reusable invitation", () => {
      expect(isInvitationValid(makeInvitation())).toBe(true);
    });

    it("returns false for malformed invitation data", () => {
      expect(isInvitationValid(makeInvitation({ token: "" }))).toBe(false);
      expect(isInvitationValid(makeInvitation({ roomId: "" }))).toBe(false);
    });

    it("does not accept a creation date from the future", () => {
      const now = Date.now();
      const invite = makeInvitation({ createdAt: new Date(now + 1000).toISOString() });
      expect(isInvitationValid(invite, now)).toBe(false);
    });
  });
});
