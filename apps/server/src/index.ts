import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { BattleRoomManager } from "./rooms/battleRoom";
import { TournamentRoomManager } from "./rooms/tournamentRoom";
import { getDefaultModeConfig } from "./modes/modes";
import { getFreestylerProfile, searchFreestylers } from "./catalog/catalog";
import {
  DailyGameError,
  getFreestylerDailyState,
  submitFreestylerDailyGuess,
} from "./games/freestylerDaily";
import { prisma } from "./db/prisma";
import type { ClientEvent, ServerEvent } from "@freestyle/shared";

const PORT = Number(process.env.WS_PORT) || 3001;

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

const battleManager = new BattleRoomManager();
const tournamentManager = new TournamentRoomManager(battleManager);

// --- REST: Health check ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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

app.get("/api/games/freestyler/today", async (req, res) => {
  try {
    const state = await getFreestylerDailyState(prisma, req.header("x-game-session"));
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
    const state = await submitFreestylerDailyGuess(
      prisma,
      req.header("x-game-session"),
      req.body.freestylerId,
    );
    res.json(state);
  } catch (error) {
    const status = error instanceof DailyGameError ? error.status : 500;
    const message = error instanceof DailyGameError ? error.message : "No se pudo registrar el intento";
    if (!(error instanceof DailyGameError)) console.error("No se pudo registrar el intento", error);
    res.status(status).json({ error: message });
  }
});

// --- REST: Crear batalla ---
app.post("/api/battles", (req, res) => {
  const { mode } = req.body;
  const battle = battleManager.createBattle(mode);
  res.json({ ...battle, adminToken: battleManager.getAdminToken(battle.id) });
});

app.post("/api/tournaments", (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const bracketMode = req.body.bracketMode === "random" ? "random" : "manual";
  if (!name) { res.status(400).json({ error: "El nombre es obligatorio" }); return; }
  res.status(201).json(tournamentManager.createTournament(name, bracketMode));
});

app.post("/api/tournaments/:id/participants", (req, res) => {
  const tournament = tournamentManager.addParticipant(req.params.id, req.body.adminToken, req.body.alias);
  if (!tournament) { res.status(400).json({ error: "No se pudo agregar el participante" }); return; }
  res.json(tournament);
});

app.post("/api/tournaments/:id/start", (req, res) => {
  const tournament = tournamentManager.startTournament(
    req.params.id,
    req.body.adminToken,
    req.body.modeConfig ?? getDefaultModeConfig("clasico"),
    req.body.replicaConfig,
  );
  if (!tournament) { res.status(400).json({ error: "El torneo requiere 4, 8, 16... participantes" }); return; }
  res.json(tournament);
});

app.post("/api/tournaments/:id/winners", (req, res) => {
  const tournament = tournamentManager.recordWinner(req.params.id, req.body.adminToken, req.body.battleId, req.body.winnerId);
  if (!tournament) { res.status(400).json({ error: "No se pudo registrar el ganador" }); return; }
  res.json(tournament);
});

app.get("/api/tournaments/:id/battles/:battleId/access", (req, res) => {
  const adminToken = typeof req.query.adminToken === "string" ? req.query.adminToken : "";
  const battleAdminToken = tournamentManager.getBattleAdminToken(req.params.id, adminToken, req.params.battleId);
  if (!battleAdminToken) { res.status(403).json({ error: "Acceso denegado" }); return; }
  res.json({ adminToken: battleAdminToken });
});

app.get("/api/tournaments/:id", (req, res) => {
  const tournament = tournamentManager.getTournament(req.params.id);
  if (!tournament) { res.status(404).json({ error: "Torneo no encontrado" }); return; }
  res.json(tournament);
});

// --- Helper: advance phase and broadcast, with server-side timer scheduling ---
function advanceAndBroadcast(battleId: string, expectedToken?: string) {
  const phase = battleManager.nextPhase(battleId, expectedToken);
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
  // Countdown phases: wait 4 seconds (3-2-1-GO) then advance to mc turn
  if (phase.phase === "countdown" || phase.phase === "pause") {
    battleManager.setPhaseTimer(battleId, 4000, () => {
      advanceAndBroadcast(battleId, phase.phaseToken);
    });
  }

  // MC turn phases: auto-advance when timePerTurn expires
  if ((phase.phase === "mc1_turn" || phase.phase === "mc2_turn") && phase.battle.mode.timerMode === "countdown" && phase.battle.mode.timePerTurn > 0) {
    const ms = phase.battle.mode.timePerTurn * 1000;
    battleManager.setPhaseTimer(battleId, ms, () => {
      advanceAndBroadcast(battleId, phase.phaseToken);
    });
  }

  // Voting with no judges: auto-resolve after 3 seconds
  if (phase.phase === "voting" && phase.battle.judges.length === 0) {
    battleManager.setPhaseTimer(battleId, 3000, () => {
      advanceAndBroadcast(battleId, phase.phaseToken);
    });
  }
}

// --- WebSocket ---
io.on("connection", (socket) => {
  console.log(`🟢 Cliente conectado: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`🔴 Cliente desconectado: ${socket.id}`);
    const room = battleManager.leaveRoom(socket.id);
    if (room) {
      io.to(room.id).emit("battle:state", room);
    }
  });

  const handleEvent = (event: ClientEvent) => {
    switch (event.type) {
      case "battle:join": {
        const joinError = battleManager.getJoinError(event.battleId, event.user, event.adminToken);
        if (joinError) { socket.emit("battle:error", { message: joinError }); return; }
        const battle = battleManager.joinBattle(event.battleId, socket.id, event.user, event.adminToken);
        if (!battle) { socket.emit("battle:error", { message: "Batalla no encontrada" }); return; }
        socket.join(event.battleId);
        io.to(event.battleId).emit("battle:state", battle);
        break;
      }

      case "battle:leave": {
        const battle = battleManager.leaveRoom(socket.id);
        if (battle) { socket.leave(battle.id); io.to(battle.id).emit("battle:state", battle); }
        break;
      }

      case "battle:start": {
        const result = battleManager.startBattle(socket.id);
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
          advanceAndBroadcast(battle.id, token);
        });
        break;
      }

      case "battle:next_phase": {
        const battle = battleManager.findBattleBySocket(socket.id);
        if (!battle) { console.log(`⚠️ next_phase: batalla no encontrada para socket ${socket.id}`); return; }
        if (!battleManager.canControlBattle(socket.id, battle)) { socket.emit("battle:error", { message: "No tienes permiso para avanzar la fase" }); return; }

        advanceAndBroadcast(battle.id, event.phaseToken);
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
        io.to(battle.id).emit("battle:state", battle);
        break;
      }

      case "battle:set_replica": {
        const battle = battleManager.setReplicaConfig(socket.id, event.config);
        if (!battle) { socket.emit("battle:error", { message: "No se pudo configurar la réplica" }); return; }
        io.to(battle.id).emit("battle:state", battle);
        break;
      }

      case "battle:complete_entry": {
        const result = battleManager.completeEntry(socket.id);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (result.shouldAdvance) advanceAndBroadcast(result.battle.id);
        else io.to(result.battle.id).emit("battle:state", result.battle);
        break;
      }

      case "judge:vote_entry": {
        const judgeIdentity = battleManager.getSocketIdentity(socket.id, "judge");
        if (!judgeIdentity) { socket.emit("battle:error", { message: "No eres juez" }); return; }
        const result = battleManager.submitPatronEntryVote(event.battleId, judgeIdentity.userId, event.points);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        io.to(result.battle.id).emit("battle:state", result.battle);
        if (result.allVoted) {
          io.to(result.battle.id).emit("battle:phase", { phase: result.battle.roundPhase });
          if (result.battle.roundPhase === "pause") {
            battleManager.setPhaseTimer(result.battle.id, 4000, () => advanceAndBroadcast(result.battle.id));
          }
        }
        break;
      }

      case "judge:vote_patron_extra": {
        const judgeIdentity = battleManager.getSocketIdentity(socket.id, "judge");
        if (!judgeIdentity) { socket.emit("battle:error", { message: "No eres juez" }); return; }
        const result = battleManager.submitPatronExtraVote(event.battleId, judgeIdentity.userId, event.mc1Extra, event.mc2Extra);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }
        if (result.allVoted) advanceAndBroadcast(result.battle.id);
        else io.to(result.battle.id).emit("battle:state", result.battle);
        break;
      }

      case "judge:vote_rubric": {
        const judgeIdentity = battleManager.getSocketIdentity(socket.id, "judge");
        if (!judgeIdentity) { socket.emit("battle:error", { message: "No eres juez" }); return; }
        const ev = event as Extract<ClientEvent, { type: "judge:vote_rubric" }>;
        const result = battleManager.submitRubricVote(ev.battleId, judgeIdentity.userId, ev.round, ev.mc1Id, ev.mc2Id, ev.mc1Scores, ev.mc2Scores);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }

        // Emitir estado actualizado
        const updatedBattle = battleManager.listBattles().find(b => b.id === ev.battleId.toLowerCase());
        if (updatedBattle) io.to(ev.battleId).emit("battle:state", updatedBattle);

        if (result.allVoted) {
          // Auto-avanzar a round_result
          advanceAndBroadcast(ev.battleId);
        }
        break;
      }

      default:
        console.warn("Evento desconocido:", (event as ClientEvent).type);
    }
  };

  socket.onAny((eventName: string, data: ClientEvent) => {
    handleEvent({ ...data, type: eventName } as ClientEvent);
  });
});

// --- Iniciar servidor ---
httpServer.listen(PORT, () => {
  console.log(`🎤 Freestyle Battle Server corriendo en http://localhost:${PORT}`);
  console.log(`   WebSocket listo | REST: http://localhost:${PORT}/api/health`);
});
