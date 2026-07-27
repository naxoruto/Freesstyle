import type { Battle } from "@freestyle/shared";
import arenaBackground from "@/assets/background.png";

const WIDTH = 1080;
const HEIGHT = 1350;
const INK = "#0a0d11";
const PAPER = "#dce8e6";
const SIGNAL = "#f04432";
const MUTED = "#84939d";

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color = PAPER, align: CanvasTextAlign = "left") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function rule(ctx: CanvasRenderingContext2D, y: number) {
  ctx.fillStyle = "#29333c";
  ctx.fillRect(70, y, WIDTH - 140, 2);
}

async function logo(ctx: CanvasRenderingContext2D) {
  try {
    const image = new Image();
    image.src = arenaBackground.src;
    await image.decode();
    // The current brand lockup only exists inside the stage artwork.
    ctx.drawImage(image, 705, 55, 675, 335, 70, 31, 245, 122);
  } catch {
    text(ctx, "FREESTYLE", 70, 92, "italic 900 43px 'Arial Narrow', Impact, sans-serif", PAPER);
    const offset = ctx.measureText("FREESTYLE").width + 10;
    text(ctx, "ARENA", 70 + offset, 92, "italic 900 43px 'Arial Narrow', Impact, sans-serif", SIGNAL);
  }
}

function formatLabel(battle: Battle) {
  const turns = battle.mode.timerMode === "manual"
    ? `${battle.mode.entriesPerParticipant} entradas por MC`
    : `${battle.mode.timePerTurn / 60} min por MC · ${battle.mode.turnStructure === "round_trip" ? "ida y vuelta" : "solo ida"}`;
  const mode = battle.mode.mode === "libre" ? "Tema libre" : battle.mode.category ?? "Conceptos aleatorios";
  return `${battle.mode.rounds} ${battle.mode.rounds === 1 ? "ronda" : "rondas"} · ${turns} · ${mode}`;
}

function setupCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear la cartelera");
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = SIGNAL;
  ctx.fillRect(0, 0, WIDTH, 14);
  return { canvas, ctx };
}

export interface BattlePosterPreview {
  dataUrl: string;
  fileName: string;
}

export function downloadBattlePoster(preview: BattlePosterPreview) {
  const link = document.createElement("a");
  link.download = preview.fileName;
  link.href = preview.dataUrl;
  link.click();
}

export async function createPreBattlePoster(battle: Battle, publicUrl: string): Promise<BattlePosterPreview> {
  const { canvas, ctx } = setupCanvas();
  const [mc1, mc2] = battle.participants;
  await logo(ctx);
  text(ctx, `CARTELERA OFICIAL · SALA ${battle.id.toUpperCase()}`, WIDTH - 70, 84, "700 18px Arial, sans-serif", MUTED, "right");
  rule(ctx, 125);

  text(ctx, "PRÓXIMA BATALLA", 70, 205, "700 20px Arial, sans-serif", SIGNAL);
  text(ctx, mc1?.alias.toUpperCase() ?? "MC POR CONFIRMAR", 70, 350, "italic 900 88px 'Arial Narrow', Impact, sans-serif", PAPER);
  text(ctx, "VS", WIDTH / 2, 445, "italic 900 44px 'Arial Narrow', Impact, sans-serif", SIGNAL, "center");
  text(ctx, mc2?.alias.toUpperCase() ?? "MC POR CONFIRMAR", WIDTH - 70, 545, "italic 900 88px 'Arial Narrow', Impact, sans-serif", PAPER, "right");
  rule(ctx, 610);

  text(ctx, "FORMATO", 70, 680, "700 17px Arial, sans-serif", MUTED);
  text(ctx, formatLabel(battle), 70, 725, "700 25px Arial, sans-serif", PAPER);

  text(ctx, `MESA DE JUECES · ${battle.judges.length}`, 70, 825, "700 17px Arial, sans-serif", MUTED);
  text(ctx, battle.judges.map(judge => judge.alias).join(" · ") || "Por confirmar", 70, 870, "700 25px Arial, sans-serif", PAPER);

  text(ctx, "PÚBLICO PRESENTE", 70, 970, "700 17px Arial, sans-serif", MUTED);
  text(ctx, String(battle.spectators.length), 70, 1065, "900 82px 'Arial Narrow', Impact, sans-serif", SIGNAL);

  rule(ctx, 1180);
  text(ctx, "Comparte la sala. Abre los micros.", 70, 1250, "italic 900 34px 'Arial Narrow', Impact, sans-serif", PAPER);
  text(ctx, publicUrl, WIDTH - 70, 1250, "700 16px Arial, sans-serif", MUTED, "right");
  return { dataUrl: canvas.toDataURL("image/png"), fileName: `cartelera-${battle.id}-pre.png` };
}

export async function createPostBattlePoster(battle: Battle, publicUrl: string): Promise<BattlePosterPreview> {
  const { canvas, ctx } = setupCanvas();
  const sorted = [...battle.participants].sort((left, right) => (battle.totalScores[right.userId] ?? 0) - (battle.totalScores[left.userId] ?? 0));
  const isTie = sorted.length > 1 && (battle.totalScores[sorted[0].userId] ?? 0) === (battle.totalScores[sorted[1].userId] ?? 0);
  const winner = isTie ? undefined : sorted[0];
  const runnerUp = sorted[1];
  const decisions = new Map<string, { name: string; mc1: number; mc2: number; ties: number }>();
  const [mc1, mc2] = battle.participants;

  battle.roundResults.forEach(result => result.judgeVotes.forEach(vote => {
    const current = decisions.get(vote.judgeId) ?? { name: vote.judgeName, mc1: 0, mc2: 0, ties: 0 };
    if (!vote.votedForId) current.ties++;
    else if (vote.votedForId === mc1?.userId) current.mc1++;
    else if (vote.votedForId === mc2?.userId) current.mc2++;
    decisions.set(vote.judgeId, current);
  }));

  await logo(ctx);
  text(ctx, `RESULTADO OFICIAL · SALA ${battle.id.toUpperCase()}`, WIDTH - 70, 84, "700 18px Arial, sans-serif", MUTED, "right");
  rule(ctx, 125);
  text(ctx, "GANADOR", 70, 215, "700 20px Arial, sans-serif", SIGNAL);
  text(ctx, winner?.alias.toUpperCase() ?? "EMPATE", 70, 365, "italic 900 105px 'Arial Narrow', Impact, sans-serif", PAPER);
  text(ctx, winner ? `${battle.totalScores[winner.userId] ?? 0} PUNTOS` : "RESULTADO IGUALADO", 70, 430, "900 32px 'Arial Narrow', Impact, sans-serif", SIGNAL);

  if (runnerUp) {
    text(ctx, runnerUp.alias.toUpperCase(), WIDTH - 70, 375, "italic 900 50px 'Arial Narrow', Impact, sans-serif", "#62707a", "right");
    text(ctx, `${battle.totalScores[runnerUp.userId] ?? 0} puntos`, WIDTH - 70, 420, "700 19px Arial, sans-serif", MUTED, "right");
  }

  rule(ctx, 495);
  text(ctx, "DECISIÓN DE LA MESA", 70, 565, "700 17px Arial, sans-serif", MUTED);
  let y = 625;
  decisions.forEach(decision => {
    const votedFor = decision.mc1 === decision.mc2 ? "Empate" : decision.mc1 > decision.mc2 ? mc1?.alias : mc2?.alias;
    text(ctx, decision.name, 70, y, "700 24px Arial, sans-serif", PAPER);
    text(ctx, `${votedFor} · ${decision.mc1}-${decision.mc2}${decision.ties ? ` · ${decision.ties} empate` : ""}`, WIDTH - 70, y, "700 22px Arial, sans-serif", SIGNAL, "right");
    y += 58;
  });
  if (decisions.size === 0) text(ctx, "Sin desglose de votos", 70, y, "700 24px Arial, sans-serif", MUTED);

  rule(ctx, 1040);
  text(ctx, "FORMATO", 70, 1110, "700 17px Arial, sans-serif", MUTED);
  text(ctx, formatLabel(battle), 70, 1155, "700 24px Arial, sans-serif", PAPER);
  text(ctx, `${battle.spectators.length} personas en el público`, 70, 1230, "700 18px Arial, sans-serif", MUTED);
  text(ctx, publicUrl, WIDTH - 70, 1230, "700 16px Arial, sans-serif", MUTED, "right");
  return { dataUrl: canvas.toDataURL("image/png"), fileName: `cartelera-${battle.id}-resultado.png` };
}
