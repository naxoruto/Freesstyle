import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { BattleRoomManager } from "./rooms/battleRoom";
import { TournamentRoomManager } from "./rooms/tournamentRoom";
import { getDefaultModeConfig } from "./modes/modes";
import { getFreestylerProfile, searchFreestylers } from "./catalog/catalog";
import { getInventoryProfile, getInventoryReport, getPendingParticipationMappings, searchInventoryProfiles } from "./inventory/inventory";
import {
  DailyGameError,
  getFreestylerDailyState,
  getFreestylerDailyStateForMode,
  giveUpFreestylerDailyForMode,
  submitFreestylerDailyGuess,
  submitFreestylerDailyGuessForMode,
} from "./games/freestylerDaily";
import { prisma } from "./db/prisma";
import { checkReadiness } from "./health/readiness";
import { authorizeInventory } from "./inventory/access";
import { validateProductionConfig } from "./config/production";
import { RateLimiter } from "./security/rateLimit";
import { createOriginPolicy } from "./security/origins";
import { isSocketPayloadValid } from "./security/socketPayload";
import { parseCookies } from "./security/cookies";
import type { ClientEvent, ServerEvent } from "@freestyle/shared";
import { DEFAULT_RECONNECT_WINDOW_MS } from "@freestyle/shared";

const PORT = Number(process.env.WS_PORT) || 3001;
validateProductionConfig(process.env);

const app = express();
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
const originAllowed = createOriginPolicy(process.env.ALLOWED_ORIGINS);
app.use(cors({ origin: (origin, callback) => callback(null, originAllowed(origin)), credentials: true }));
app.use(express.json({ limit: "32kb" }));

const inventoryLimiter = new RateLimiter(30, 60_000);
const creationLimiter = new RateLimiter(30, 60_000);
const gameLimiter = new RateLimiter(60, 60_000);
const socketLimiter = new RateLimiter(180, 60_000);
function limitRequests(limiter: RateLimiter): express.RequestHandler {
  return (req, res, next) => {
    if (limiter.consume(req.ip ?? "unknown")) { next(); return; }
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Demasiadas solicitudes. Inténtalo de nuevo en un minuto." });
  };
}
app.use("/api/inventory", limitRequests(inventoryLimiter));
app.use("/api/battles", (req, res, next) => {
  if (req.method === "POST" && req.path === "/") { limitRequests(creationLimiter)(req, res, next); return; }
  next();
});
app.use("/api/tournaments", (req, res, next) => {
  if (req.method === "POST" && req.path === "/") { limitRequests(creationLimiter)(req, res, next); return; }
  next();
});
app.use("/api/games/freestyler/today", (req, res, next) => {
  if (req.method === "POST") { limitRequests(gameLimiter)(req, res, next); return; }
  next();
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: (origin, callback) => callback(null, originAllowed(origin)), methods: ["GET", "POST"], credentials: true },
  allowRequest: (req, callback) => callback(null, originAllowed(req.headers.origin)),
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 32 * 1024,
});

const battleManager = new BattleRoomManager();
const tournamentManager = new TournamentRoomManager(battleManager);
const blockedBattles = new Set<string>();
const roomEventQueues = new Map<string, Promise<void>>();

function enqueueRoomTask(roomId: string, task: () => void | Promise<void>): void {
  const previous = roomEventQueues.get(roomId) ?? Promise.resolve();
  const current = previous.then(task).catch(error => console.error("No se pudo procesar la acción de la sala", error));
  roomEventQueues.set(roomId, current);
  void current.then(() => { if (roomEventQueues.get(roomId) === current) roomEventQueues.delete(roomId); });
}

function blockBattle(battleId: string, message: string): void {
  blockedBattles.add(battleId);
  battleManager.quarantineBattle(battleId);
  io.to(battleId).emit("battle:error", { message });
  io.in(battleId).disconnectSockets(true);
}

async function persistRolesOrBlock(battleId: string): Promise<boolean> {
  try {
    await battleManager.persistMemberRoles(battleId);
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los permisos de la sala", error);
    blockBattle(battleId, "No se pudieron guardar los permisos. La sala quedó bloqueada; vuelve a conectarte cuando se restablezca el servicio.");
    return false;
  }
}

battleManager.onSessionCleanup = (battleId) => {
  enqueueRoomTask(battleId, () => {
    if (blockedBattles.has(battleId)) return;
    const battle = battleManager.listBattles().find(b => b.id === battleId);
    if (battle) io.to(battleId).emit("battle:state", battle);
  });
};

battleManager.onPersistenceFailure = (battleId) => {
  blockBattle(battleId, "No se pudo guardar el estado de la sala. La sala quedó bloqueada; vuelve a conectarte cuando se restablezca el servicio.");
};

// --- REST: Health check ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/ready", async (_req, res) => {
  const readiness = await checkReadiness(() => prisma.$queryRaw`SELECT 1`);
  res.status(readiness.status === "ready" ? 200 : 503).json(readiness);
});

app.get("/api/catalog/freestylers", async (req, res) => {
  try {
    const freestylers = await searchFreestylers(req.query.q, req.query.limit);
    res.json({ data: freestylers });
  } catch (error) {
    console.error("No se pudo buscar el catálogo de freestylers", error);
    res.status(500).json({ error: "No se pudo consultar el catálogo" });
  }
});

app.get("/api/catalog/freestylers/:slug", async (req, res) => {
  try {
    const freestyler = await getFreestylerProfile(req.params.slug);
    if (!freestyler) { res.status(404).json({ error: "Freestyler no encontrado" }); return; }
    res.json({ data: freestyler });
  } catch (error) {
    console.error("No se pudo consultar el perfil de freestyler", error);
    res.status(500).json({ error: "No se pudo consultar el perfil" });
  }
});

app.use("/api/inventory", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!authorizeInventory(process.env.INVENTORY_ADMIN_TOKEN, req.header("authorization"))) {
    res.status(401).json({ error: "Acceso al inventario denegado" });
    return;
  }
  next();
});

app.get("/api/inventory/report", async (_req, res) => {
  try {
    res.json({ data: await getInventoryReport() });
  } catch (error) {
    console.error("No se pudo consultar el reporte de inventario", error);
    res.status(500).json({ error: "No se pudo consultar el inventario" });
  }
});

app.get("/api/inventory/profiles", async (req, res) => {
  try {
    const profiles = await searchInventoryProfiles(req.query.q, req.query.limit, req.query.provider, req.query.linked);
    res.json({ data: profiles });
  } catch (error) {
    console.error("No se pudo buscar el inventario externo", error);
    res.status(500).json({ error: "No se pudo buscar el inventario" });
  }
});

app.get("/api/inventory/profiles/:id", async (req, res) => {
  try {
    const profile = await getInventoryProfile(req.params.id);
    if (!profile) { res.status(404).json({ error: "Perfil externo no encontrado" }); return; }
    res.json({ data: profile });
  } catch (error) {
    console.error("No se pudo consultar el perfil externo", error);
    res.status(500).json({ error: "No se pudo consultar el perfil externo" });
  }
});

app.get("/api/inventory/pending-participations", async (req, res) => {
  try {
    res.json(await getPendingParticipationMappings(req.query.q, req.query.limit));
  } catch (error) {
    console.error("No se pudo consultar participaciones pendientes", error);
    res.status(500).json({ error: "No se pudo consultar participaciones pendientes" });
  }
});

app.get("/api/games/freestyler/today", async (req, res) => {
  try {
    const demo = req.header("x-game-demo") === "true";
    const state = demo
      ? await getFreestylerDailyStateForMode(prisma, req.header("x-game-session"), true)
      : await getFreestylerDailyState(prisma, req.header("x-game-session"));
    res.json(state);
  } catch (error) {
    const status = error instanceof DailyGameError ? error.status : 500;
    const message = error instanceof DailyGameError ? error.message : "No se pudo cargar el desafío diario";
    if (!(error instanceof DailyGameError)) console.error("No se pudo cargar el desafío diario", error);
    res.status(status).json({ error: message });
  }
});

app.post("/api/games/freestyler/today/guesses", async (req, res) => {
  try {
    const demo = req.header("x-game-demo") === "true";
    const state = demo
      ? await submitFreestylerDailyGuessForMode(prisma, req.header("x-game-session"), req.body.freestylerId, true)
      : await submitFreestylerDailyGuess(prisma, req.header("x-game-session"), req.body.freestylerId);
    res.json(state);
  } catch (error) {
    const status = error instanceof DailyGameError ? error.status : 500;
    const message = error instanceof DailyGameError ? error.message : "No se pudo registrar el intento";
    if (!(error instanceof DailyGameError)) console.error("No se pudo registrar el intento", error);
    res.status(status).json({ error: message });
  }
});

app.post("/api/games/freestyler/today/give-up", async (req, res) => {
  try {
    const demo = req.header("x-game-demo") === "true";
    const state = await giveUpFreestylerDailyForMode(prisma, req.header("x-game-session"), demo);
    res.json(state);
  } catch (error) {
    const status = error instanceof DailyGameError ? error.status : 500;
    const message = error instanceof DailyGameError ? error.message : "No se pudo cerrar la partida";
    if (!(error instanceof DailyGameError)) console.error("No se pudo cerrar la partida", error);
    res.status(status).json({ error: message });
  }
});

// --- REST: Crear batalla ---
app.post("/api/battles", async (req, res) => {
  const { mode } = req.body;
  try {
    const battle = await battleManager.createBattleDurably(mode);
    const adminToken = battleManager.getAdminToken(battle.id);
    if (adminToken) res.cookie(`battle_admin_${battle.id}`, adminToken, { httpOnly: true, sameSite: "lax", path: "/" });
    res.json(battle);
  } catch (error) {
    console.error("No se pudo crear la batalla", error);
    res.status(503).json({ error: "No se pudo guardar la batalla. Inténtalo de nuevo." });
  }
});

app.post("/api/tournaments", (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const bracketMode = req.body.bracketMode === "random" ? "random" : "manual";
  const type = req.body.type === "with_third_place" || req.body.type === "double_elimination"
    ? req.body.type
    : "single_elimination";
  const options = {
    logo: typeof req.body.logo === "string" && req.body.logo.trim() ? req.body.logo.trim() : undefined,
    organizer: typeof req.body.organizer === "string" && req.body.organizer.trim() ? req.body.organizer.trim() : undefined,
    capacity: typeof req.body.capacity === "number" ? req.body.capacity : undefined,
    modeConfig: req.body.modeConfig,
  };
  if (!name || name.length > 100) { res.status(400).json({ error: "El nombre es obligatorio y debe tener hasta 100 caracteres" }); return; }
  if (req.body.participants !== undefined) {
    const created = tournamentManager.createTournamentWithParticipants(name, bracketMode, type, req.body.participants, options);
    if (!created) { res.status(400).json({ error: "Revisa la lista, la capacidad y las reglas del torneo" }); return; }
    res.status(201).json(created);
    return;
  }
  const created = tournamentManager.createTournament(name, bracketMode, type, options);
  if (!created) { res.status(400).json({ error: "Revisa la capacidad y las reglas del torneo" }); return; }
  res.status(201).json(created);
});

app.post("/api/tournaments/:id/participants", (req, res) => {
  if (typeof req.body?.alias !== "string" || !req.body.alias.trim() || req.body.alias.trim().length > 40) {
    res.status(400).json({ error: "El alias debe tener entre 1 y 40 caracteres" });
    return;
  }
  const tournament = tournamentManager.addParticipant(req.params.id, req.body.adminToken, req.body.alias);
  if (!tournament) { res.status(400).json({ error: "No se pudo agregar el participante" }); return; }
  res.json(tournament);
});

app.delete("/api/tournaments/:id/participants/:participantId", (req, res) => {
  const tournament = tournamentManager.removeParticipant(req.params.id, req.body?.adminToken, req.params.participantId);
  if (!tournament) { res.status(400).json({ error: "No se pudo quitar la inscripción" }); return; }
  res.json(tournament);
});

app.post("/api/tournaments/:id/participants/move", (req, res) => {
  const destination = req.body?.destination;
  if (destination !== "titular" && destination !== "suplente") { res.status(400).json({ error: "Destino inválido" }); return; }
  const tournament = tournamentManager.moveParticipant(req.params.id, req.body.adminToken, req.body.participantId, destination);
  if (!tournament) { res.status(400).json({ error: "No se pudo mover la inscripción" }); return; }
  res.json(tournament);
});

app.post("/api/tournaments/:id/participants/confirm", (req, res) => {
  const tournament = tournamentManager.confirmParticipants(req.params.id, req.body?.adminToken);
  if (!tournament) { res.status(400).json({ error: "Completa el cupo de titulares antes de confirmar" }); return; }
  res.json(tournament);
});

app.put("/api/tournaments/:id/rules", (req, res) => {
  const tournament = tournamentManager.updateRules(req.params.id, req.body?.adminToken, req.body?.modeConfig);
  if (!tournament) { res.status(400).json({ error: "No se pudieron actualizar las reglas" }); return; }
  res.json(tournament);
});

app.post("/api/tournaments/:id/participants/order", (req, res) => {
  const orderedIds = Array.isArray(req.body.orderedIds) ? req.body.orderedIds : [];
  const tournament = tournamentManager.reorderParticipants(req.params.id, req.body.adminToken, orderedIds);
  if (!tournament) { res.status(400).json({ error: "No se pudo actualizar el orden de participantes" }); return; }
  res.json(tournament);
});

app.post("/api/tournaments/:id/start", (req, res) => {
  const tournament = tournamentManager.startTournament(
    req.params.id,
    req.body.adminToken,
    req.body.modeConfig ?? getDefaultModeConfig("clasico"),
    req.body.replicaConfig,
  );
  if (!tournament) { res.status(400).json({ error: "Confirma los titulares y completa el cupo antes de iniciar" }); return; }
  res.json(tournament);
});

app.post("/api/tournaments/:id/winners", (req, res) => {
  const tournament = tournamentManager.recordWinner(req.params.id, req.body.adminToken, req.body.battleId, req.body.winnerId);
  if (!tournament) { res.status(400).json({ error: "No se pudo registrar el ganador" }); return; }
  res.json(tournament);
});

app.post("/api/tournaments/:id/battles/:battleId/access", (req, res) => {
  const adminToken = typeof req.body.adminToken === "string" ? req.body.adminToken : "";
  const battleAdminToken = tournamentManager.getBattleAdminToken(req.params.id, adminToken, req.params.battleId);
  if (!battleAdminToken) { res.status(403).json({ error: "Acceso denegado" }); return; }
  res.json({ adminToken: battleAdminToken });
});

app.get("/api/tournaments/:id", (req, res) => {
  const tournament = tournamentManager.getTournament(req.params.id);
  if (!tournament) { res.status(404).json({ error: "Torneo no encontrado" }); return; }
  res.json(tournament);
});

app.get("/api/battles/:id/invite", (req, res) => {
  const invite = typeof req.query.invite === "string" ? req.query.invite : "";
  if (!invite) { res.status(400).json({ error: "Token de invitación requerido" }); return; }
  const result = battleManager.inspectInvitation(invite, req.params.id);
  if (!result) { res.status(410).json({ error: "Invitación inválida o revocada" }); return; }
  res.json({ battleId: result.roomId });
});

// --- Helper: advance phase and broadcast, with server-side timer scheduling ---
async function advanceAndBroadcast(battleId: string, expectedToken?: string, isAuto = false): Promise<void> {
  if (blockedBattles.has(battleId.toLowerCase())) return;
  let phase: Awaited<ReturnType<typeof battleManager.nextPhaseDurably>>;
  try { phase = await battleManager.nextPhaseDurably(battleId, expectedToken, isAuto); }
  catch (error) {
    console.error("No se pudo guardar la transición de batalla", error);
    blockBattle(battleId.toLowerCase(), "No se pudo guardar el avance. La sala quedó temporalmente bloqueada.");
    return;
  }
  if (blockedBattles.has(battleId.toLowerCase())) return;
  if ("error" in phase) return;

  io.to(battleId).emit("battle:state", phase.battle);

  if (phase.battle.status === "finished") {
    const finalScores = Object.entries(phase.battle.totalScores).sort(([, left], [, right]) => right - left);
    if (finalScores.length >= 2 && finalScores[0][1] !== finalScores[1][1]) {
      tournamentManager.recordBattleResult(phase.battle.id, finalScores[0][0]);
    }
  }

  if (phase.word) {
    io.to(battleId).emit("battle:round_start", {
      round: phase.battle.currentRound,
      word: phase.word,
      totalRounds: phase.battle.mode.rounds,
    });
  }

  io.to(battleId).emit("battle:phase", {
    phase: phase.phase,
    participantId: phase.participantId,
    timeRemaining: phase.timeRemaining,
    phaseToken: phase.phaseToken,
  });

  // Emit round_result with rubric data when available
  if (phase.phase === "round_result" && phase.rubricVotes && phase.scores) {
    const sortedScores = Object.entries(phase.scores).sort(([, left], [, right]) => right - left);
    const winnerId = sortedScores.length >= 2 && sortedScores[0][1] !== sortedScores[1][1] ? sortedScores[0][0] : undefined;
    io.to(battleId).emit("battle:round_result", {
      round: phase.battle.currentRound,
      winnerId,
      rubricVotes: phase.rubricVotes,
      scores: phase.scores,
    });
  }

  // --- Server-side timer scheduling ---
  scheduleCurrentPhase(phase.battle);
}

function scheduleCurrentPhase(battle: import("@freestyle/shared").Battle): void {
  const battleId = battle.id;
  const token = battle.phaseToken;
  // Countdown phases: wait 4 seconds (3-2-1-GO) then advance to mc turn
  if (battle.roundPhase === "countdown" || battle.roundPhase === "pause") {
    battleManager.setPhaseTimer(battleId, 4000, () => {
      enqueueRoomTask(battleId.toLowerCase(), () => advanceAndBroadcast(battleId, token, true));
    });
  }

  // MC turn phases: auto-advance when timePerTurn expires
  if ((battle.roundPhase === "mc1_turn" || battle.roundPhase === "mc2_turn") && battle.mode.timerMode === "countdown" && battle.mode.timePerTurn > 0) {
    const ms = battle.mode.timePerTurn * 1000;
    battleManager.setPhaseTimer(battleId, ms, () => {
      enqueueRoomTask(battleId.toLowerCase(), () => advanceAndBroadcast(battleId, token, true));
    });
  }

  // Voting with no judges: auto-resolve after 3 seconds
  if (battle.roundPhase === "voting" && battle.judges.length === 0 && battle.mode.votingSystem !== "room_vote") {
    battleManager.setPhaseTimer(battleId, 3000, () => {
      enqueueRoomTask(battleId.toLowerCase(), () => advanceAndBroadcast(battleId, token, true));
    });
  }
}

// --- WebSocket ---
io.on("connection", (socket) => {
  console.log(`🟢 Cliente conectado: ${socket.id}`);
  let sessionHeartbeat: ReturnType<typeof setInterval> | undefined;
  const stopHeartbeat = () => { if (sessionHeartbeat) clearInterval(sessionHeartbeat); sessionHeartbeat = undefined; };
  const startHeartbeat = () => {
    stopHeartbeat();
    sessionHeartbeat = setInterval(() => {
      const room = battleManager.findBattleBySocket(socket.id);
      if (!room || blockedBattles.has(room.id)) return;
      void battleManager.persistSessionForSocket(socket.id).catch(error => {
        console.error("No se pudo renovar la sesión", error);
        blockBattle(room.id, "No se pudo renovar la sesión. La sala quedó temporalmente bloqueada.");
      });
    }, Math.floor(DEFAULT_RECONNECT_WINDOW_MS / 2));
  };

  socket.on("disconnect", () => {
    console.log(`🔴 Cliente desconectado: ${socket.id}`);
    stopHeartbeat();
    const disconnectedRoom = battleManager.findBattleBySocket(socket.id);
    if (disconnectedRoom && !blockedBattles.has(disconnectedRoom.id)) {
      void battleManager.persistSessionForSocket(socket.id).catch(error => console.error("No se pudo actualizar la caducidad de la sesión", error));
    }
    enqueueRoomTask(disconnectedRoom?.id ?? `socket:${socket.id}`, async () => {
      const result = battleManager.handleDisconnect(socket.id);
      if (result && !blockedBattles.has(result.battleId)) {
        const battle = battleManager.listBattles().find(b => b.id === result.battleId);
        if (battle) {
          io.to(result.battleId).emit("battle:state", battle);
          if (battleManager.isRoomVoteComplete(result.battleId)) await advanceAndBroadcast(result.battleId);
        }
      }
    });
  });

  const handleEvent = async (event: ClientEvent): Promise<void> => {
    switch (event.type) {
      case "battle:join": {
        const cookieToken = parseCookies(socket.handshake.headers.cookie)[`battle_admin_${event.battleId.toLowerCase()}`];
        const adminToken = cookieToken ?? event.adminToken;
        const requestedRole: "admin" | undefined = adminToken ? "admin" : event.user.role === "admin" ? "admin" : undefined;
        const joiningUser = { ...event.user, role: requestedRole };
        const joinError = battleManager.getJoinError(event.battleId, joiningUser, adminToken, event.inviteToken);
        if (joinError) { socket.emit("battle:error", { message: joinError }); return; }
        if (battleManager.hasMember(event.battleId, joiningUser.id)) { socket.emit("battle:error", { message: "Esta identidad ya está en la sala; vuelve a conectarte con tu sesión." }); return; }
        const battle = battleManager.joinBattle(event.battleId, socket.id, joiningUser, adminToken, event.inviteToken);
        if (!battle) { socket.emit("battle:error", { message: "Batalla no encontrada" }); return; }
        const sessionId = battleManager.getSessionId(socket.id);
        try {
          await battleManager.persistSessionForSocket(socket.id);
          if (!await persistRolesOrBlock(battle.id)) throw new Error("No se pudieron guardar los permisos");
          if (!socket.connected) {
            if (sessionId) await battleManager.revokePersistedSession(battle.id, sessionId);
            battleManager.leaveRoom(socket.id);
            await persistRolesOrBlock(battle.id);
            return;
          }
        } catch (error) {
          console.error("No se pudo guardar la sesión de la sala", error);
          blockBattle(battle.id, "No se pudo guardar la sesión. La sala quedó temporalmente bloqueada.");
          socket.emit("battle:error", { message: "No se pudo guardar la sesión. Inténtalo más tarde." });
          return;
        }
        socket.join(event.battleId);
        startHeartbeat();
        io.to(event.battleId).emit("battle:state", battle);
        if (sessionId) socket.emit("battle:session", { sessionId });
        const member = battleManager.getSocketMember(socket.id);
        if (member) socket.emit("room:joined", member);
        break;
      }

      case "battle:leave": {
        const current = battleManager.findBattleBySocket(socket.id);
        const token = battleManager.getSessionId(socket.id);
        if (current && token) {
          try { await battleManager.revokePersistedSession(current.id, token); }
          catch (error) { console.error("No se pudo revocar la sesión", error); blockBattle(current.id, "No se pudo cerrar la sesión de la sala."); return; }
        }
        const battle = battleManager.leaveRoom(socket.id);
        stopHeartbeat();
        if (battle && await persistRolesOrBlock(battle.id)) { socket.leave(battle.id); io.to(battle.id).emit("battle:state", battle); }
        break;
      }

      case "battle:start": {
        const room = battleManager.findBattleBySocket(socket.id);
        let result: Awaited<ReturnType<typeof battleManager.startBattleDurably>>;
        try { result = await battleManager.startBattleDurably(socket.id); }
        catch (error) {
          console.error("No se pudo guardar el inicio de la batalla", error);
          if (room) blockBattle(room.id, "No se pudo guardar el inicio. La sala quedó temporalmente bloqueada.");
          return;
        }
        if (room && blockedBattles.has(room.id)) return;
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }

        const battle = result.battle;
        io.to(battle.id).emit("battle:state", battle);
        console.log(`🚀 Batalla ${battle.id} iniciada`);

        // Emit initial phase with token
        const token = battleManager.getPhaseToken(battle.id);
        io.to(battle.id).emit("battle:phase", {
          phase: "countdown",
          phaseToken: token,
        });

        // Server drives the countdown → mc1_turn transition
        battleManager.setPhaseTimer(battle.id, 4000, () => {
          enqueueRoomTask(battle.id, () => advanceAndBroadcast(battle.id, token, true));
        });
        break;
      }

      case "battle:next_phase": {
        const battle = battleManager.findBattleBySocket(socket.id);
        if (!battle) { console.log(`⚠️ next_phase: batalla no encontrada para socket ${socket.id}`); return; }
        if (!battleManager.canControlBattle(socket.id, battle)) { socket.emit("battle:error", { message: "No tienes permiso para avanzar la fase" }); return; }

        await advanceAndBroadcast(battle.id, event.phaseToken);
        break;
      }

      case "battle:resume": {
        const room = battleManager.findBattleBySocket(socket.id);
        if (!room) return;
        try {
          const result = await battleManager.resumeBattleDurably(socket.id, event.action);
          if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
          if (blockedBattles.has(room.id)) return;
          io.to(room.id).emit("battle:state", result.battle);
          io.to(room.id).emit("battle:phase", { phase: room.roundPhase, participantId: room.currentTurn, timeRemaining: room.timeRemaining, phaseToken: room.phaseToken });
          scheduleCurrentPhase(room);
          if (battleManager.isVotingComplete(room.id)) await advanceAndBroadcast(room.id, room.phaseToken, true);
        } catch (error) {
          console.error("No se pudo guardar la reanudación", error);
          blockBattle(room.id, "No se pudo guardar la reanudación. La sala quedó temporalmente bloqueada.");
        }
        break;
      }

      case "battle:set_mode": {
        const battle = battleManager.setMode(socket.id, event.mode);
        if (!battle) { socket.emit("battle:error", { message: "No se pudo actualizar la configuración" }); return; }
        io.to(battle.id).emit("battle:state", battle);
        break;
      }

      case "battle:set_host": {
        const battle = battleManager.transferHost(socket.id, event.targetUserId);
        if (!battle) { socket.emit("battle:error", { message: "No se pudo transferir el rol de host" }); return; }
        if (!await persistRolesOrBlock(battle.id)) return;
        io.to(battle.id).emit("battle:state", battle);
        break;
      }

      case "battle:change_role": {
        const result = battleManager.changeRole(socket.id, event.targetUserId, event.newRole);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (!await persistRolesOrBlock(result.id)) return;
        io.to(result.id).emit("battle:state", result);
        break;
      }

      case "battle:set_replica": {
        const battle = battleManager.setReplicaConfig(socket.id, event.config);
        if (!battle) { socket.emit("battle:error", { message: "No se pudo configurar la réplica" }); return; }
        io.to(battle.id).emit("battle:state", battle);
        break;
      }

      case "battle:reconnect": {
        const result = await battleManager.reconnectPersisted(event.battleId, event.sessionId, socket.id);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        try { await battleManager.persistSessionForSocket(socket.id); }
        catch (error) { console.error("No se pudo renovar la sesión", error); blockBattle(result.battle.id, "No se pudo recuperar la sesión."); socket.emit("battle:error", { message: "No se pudo recuperar la sesión." }); socket.disconnect(true); return; }
        startHeartbeat();
        socket.join(result.battle.id);
        socket.emit("battle:session", { sessionId: result.sessionId });
        const member = battleManager.getSocketMember(socket.id);
        if (member) socket.emit("room:joined", member);
        io.to(result.battle.id).emit("battle:state", result.battle);
        break;
      }

      case "battle:complete_entry": {
        const room = battleManager.findBattleBySocket(socket.id);
        let result: Awaited<ReturnType<typeof battleManager.completeEntryDurably>>;
        try { result = await battleManager.completeEntryDurably(socket.id); }
        catch (error) {
          console.error("No se pudo guardar la entrada", error);
          if (room) blockBattle(room.id, "No se pudo guardar la entrada. La sala quedó temporalmente bloqueada.");
          return;
        }
        if (room && blockedBattles.has(room.id)) return;
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (result.shouldAdvance) await advanceAndBroadcast(result.battle.id);
        else io.to(result.battle.id).emit("battle:state", result.battle);
        break;
      }

      case "battle:revoke_role": {
        const result = battleManager.revokeRole(socket.id, event.targetUserId, event.role);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (!await persistRolesOrBlock(result.id)) return;
        io.to(result.id).emit("battle:state", result);
        break;
      }

      case "battle:grant_admin": {
        const result = battleManager.grantAdmin(socket.id, event.targetUserId);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (!await persistRolesOrBlock(result.id)) return;
        io.to(result.id).emit("battle:state", result);
        break;
      }

      case "battle:transfer_admin": {
        const result = battleManager.transferAdmin(socket.id, event.targetUserId);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (!await persistRolesOrBlock(result.id)) return;
        io.to(result.id).emit("battle:state", result);
        break;
      }

      case "battle:revoke_admin": {
        const result = battleManager.revokeAdmin(socket.id, event.targetUserId);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (!await persistRolesOrBlock(result.id)) return;
        io.to(result.id).emit("battle:state", result);
        break;
      }

      case "battle:create_invitation": {
        const token = battleManager.createInvitationForSocket(socket.id, event.regenerate === true);
        if (!token) { socket.emit("battle:error", { message: "No tienes permiso para crear invitaciones" }); return; }
        socket.emit("battle:invitation", { token });
        break;
      }

      case "judge:vote_entry": {
        const judgeIdentity = battleManager.getSocketIdentityForBattle(socket.id, "judge", event.battleId);
        if (!judgeIdentity) { socket.emit("battle:error", { message: "No eres juez" }); return; }
        let result: Awaited<ReturnType<typeof battleManager.submitPatronEntryVoteDurably>>;
        try { result = await battleManager.submitPatronEntryVoteDurably(event.battleId, judgeIdentity.userId, event.points); }
        catch (error) {
          console.error("No se pudo guardar el voto de entrada", error);
          blockBattle(event.battleId.toLowerCase(), "No se pudo guardar el voto. La sala quedó temporalmente bloqueada.");
          return;
        }
        if (blockedBattles.has(event.battleId.toLowerCase())) return;
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        io.to(result.battle.id).emit("battle:state", result.battle);
        if (result.allVoted) {
          io.to(result.battle.id).emit("battle:phase", { phase: result.battle.roundPhase, phaseToken: result.battle.phaseToken, timeRemaining: result.battle.timeRemaining });
          if (result.battle.roundPhase === "pause") {
            const token = result.battle.phaseToken;
            battleManager.setPhaseTimer(result.battle.id, 4000, () => enqueueRoomTask(result.battle.id, () => advanceAndBroadcast(result.battle.id, token, true)));
          }
        }
        break;
      }

      case "judge:vote_patron_extra": {
        const judgeIdentity = battleManager.getSocketIdentityForBattle(socket.id, "judge", event.battleId);
        if (!judgeIdentity) { socket.emit("battle:error", { message: "No eres juez" }); return; }
        let result: Awaited<ReturnType<typeof battleManager.submitPatronExtraVoteDurably>>;
        try { result = await battleManager.submitPatronExtraVoteDurably(event.battleId, judgeIdentity.userId, event.mc1Extra, event.mc2Extra); }
        catch (error) {
          console.error("No se pudo guardar el voto extra", error);
          blockBattle(event.battleId.toLowerCase(), "No se pudo guardar el voto. La sala quedó temporalmente bloqueada.");
          return;
        }
        if (blockedBattles.has(event.battleId.toLowerCase())) return;
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (result.allVoted) await advanceAndBroadcast(result.battle.id);
        else io.to(result.battle.id).emit("battle:state", result.battle);
        break;
      }

      case "judge:vote_free": {
        const judgeIdentity = battleManager.getSocketIdentityForBattle(socket.id, "judge", event.battleId);
        if (!judgeIdentity) { socket.emit("battle:error", { message: "No eres juez" }); return; }
        let result: Awaited<ReturnType<typeof battleManager.submitFreeVoteDurably>>;
        try { result = await battleManager.submitFreeVoteDurably(event.battleId, judgeIdentity.userId, event.votedForId); }
        catch (error) {
          console.error("No se pudo guardar el voto libre", error);
          blockBattle(event.battleId.toLowerCase(), "No se pudo guardar el voto. La sala quedó temporalmente bloqueada.");
          return;
        }
        if (blockedBattles.has(event.battleId.toLowerCase())) return;
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (result.allVoted) await advanceAndBroadcast(result.battle.id);
        else io.to(result.battle.id).emit("battle:state", result.battle);
        break;
      }

      case "room:vote": {
        let result: Awaited<ReturnType<typeof battleManager.submitRoomVoteDurably>>;
        try { result = await battleManager.submitRoomVoteDurably(socket.id, event.battleId, event.votedForId); }
        catch (error) {
          console.error("No se pudo guardar el voto de sala", error);
          blockBattle(event.battleId.toLowerCase(), "No se pudo guardar el voto. La sala quedó temporalmente bloqueada.");
          return;
        }
        if (blockedBattles.has(event.battleId.toLowerCase())) return;
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (result.allVoted) await advanceAndBroadcast(result.battle.id);
        else io.to(result.battle.id).emit("battle:state", result.battle);
        break;
      }

      case "judge:vote_rubric": {
        const judgeIdentity = battleManager.getSocketIdentityForBattle(socket.id, "judge", event.battleId);
        if (!judgeIdentity) { socket.emit("battle:error", { message: "No eres juez" }); return; }
        const ev = event as Extract<ClientEvent, { type: "judge:vote_rubric" }>;
        let result: Awaited<ReturnType<typeof battleManager.submitRubricVoteDurably>>;
        try { result = await battleManager.submitRubricVoteDurably(ev.battleId, judgeIdentity.userId, ev.round, ev.mc1Id, ev.mc2Id, ev.mc1Scores, ev.mc2Scores); }
        catch (error) {
          console.error("No se pudo guardar el voto de rúbrica", error);
          blockBattle(ev.battleId.toLowerCase(), "No se pudo guardar el voto. La sala quedó temporalmente bloqueada.");
          return;
        }
        if (blockedBattles.has(ev.battleId.toLowerCase())) return;
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }

        // Emitir estado actualizado
        const updatedBattle = battleManager.listBattles().find(b => b.id === ev.battleId.toLowerCase());
        if (updatedBattle) io.to(ev.battleId).emit("battle:state", updatedBattle);

        if (result.allVoted) {
          // Auto-avanzar a round_result
          await advanceAndBroadcast(ev.battleId);
        }
        break;
      }

      default:
        console.warn("Evento desconocido:", (event as ClientEvent).type);
    }
  };

  socket.onAny((eventName: string, data: ClientEvent) => {
    if (!socketLimiter.consume(socket.id)) { socket.emit("battle:error", { message: "Demasiadas acciones. Espera un momento." }); return; }
    if (!isSocketPayloadValid(eventName, data)) { socket.emit("battle:error", { message: "Datos de la acción inválidos." }); return; }
    const event = { ...data, type: eventName } as ClientEvent;
    const attachedRoom = battleManager.findBattleBySocket(socket.id)?.id;
    const requestedRoom = "battleId" in event && typeof event.battleId === "string" ? event.battleId.toLowerCase() : undefined;
    const roomId = attachedRoom ?? requestedRoom ?? `socket:${socket.id}`;
    if (blockedBattles.has(roomId)) { socket.emit("battle:error", { message: "La sala está temporalmente bloqueada por un error de almacenamiento." }); return; }
    const previous = roomEventQueues.get(roomId) ?? Promise.resolve();
    const current = previous.then(() => {
      if (!socket.connected) return;
      if (blockedBattles.has(roomId)) { socket.emit("battle:error", { message: "La sala está temporalmente bloqueada por un error de almacenamiento." }); return; }
      return handleEvent(event);
    }).catch(error => {
      console.error("No se pudo procesar la acción de la sala", error);
      socket.emit("battle:error", { message: "No se pudo procesar la acción." });
    });
    roomEventQueues.set(roomId, current);
    void current.then(() => { if (roomEventQueues.get(roomId) === current) roomEventQueues.delete(roomId); });
  });
});

// --- Iniciar servidor ---
void Promise.all([
  battleManager.loadActiveBattlesFromDb(),
  tournamentManager.loadTournamentsFromDb(),
]).then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🎤 Freestyle Battle Server corriendo en http://localhost:${PORT}`);
    console.log(`   WebSocket listo | REST: http://localhost:${PORT}/api/health`);
  });
}).catch(error => {
  console.error("No se pudieron recuperar las salas; servidor no iniciado", error);
  process.exitCode = 1;
});
