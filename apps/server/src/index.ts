import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { BattleRoomManager } from "./rooms/battleRoom";
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

// --- REST: Health check ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- REST: Lista de batallas activas ---
app.get("/api/battles", (_req, res) => {
  const battles = battleManager.listBattles();
  res.json(battles);
});

// --- REST: Crear batalla ---
app.post("/api/battles", (req, res) => {
  const { mode } = req.body;
  const battle = battleManager.createBattle(mode);
  res.json(battle);
});

// --- Helper: advance phase and broadcast, with server-side timer scheduling ---
function advanceAndBroadcast(battleId: string, expectedToken?: string) {
  const phase = battleManager.nextPhase(battleId, expectedToken);
  if ("error" in phase) return;

  io.to(battleId).emit("battle:state", phase.battle);

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

  // --- Server-side timer scheduling ---
  // Countdown phases: wait 4 seconds (3-2-1-GO) then advance to mc turn
  if (phase.phase === "countdown" || phase.phase === "pause") {
    battleManager.setPhaseTimer(battleId, 4000, () => {
      advanceAndBroadcast(battleId, phase.phaseToken);
    });
  }

  // MC turn phases: auto-advance when timePerTurn expires
  if ((phase.phase === "mc1_turn" || phase.phase === "mc2_turn") && phase.battle.mode.timePerTurn > 0) {
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
        const battle = battleManager.joinBattle(event.battleId, socket.id, event.user);
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

        // Use the token from the client event if available, otherwise proceed without
        const expectedToken = (event as any).phaseToken as string | undefined;
        advanceAndBroadcast(battle.id, expectedToken);
        break;
      }

      case "judge:vote_round": {
        const socketUser = battleManager.getSocketUser(socket.id);
        if (!socketUser) { socket.emit("battle:error", { message: "Usuario no encontrado" }); return; }
        const result = battleManager.submitVote(event.battleId, socketUser.userId, event.round, event.winnerId);
        if ("error" in result) { socket.emit("battle:error", { message: result.error }); return; }

        // Emitir estado de votos
        io.to(event.battleId).emit("battle:state", battleManager.listBattles().find(b => b.id === event.battleId.toLowerCase())!);

        if (result.allVoted && result.winnerId) {
          // Auto-avanzar a round_result
          advanceAndBroadcast(event.battleId);
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
