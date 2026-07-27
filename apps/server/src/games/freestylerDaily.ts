import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  DailyAttributeResult,
  FreestylerDailyGuess,
  FreestylerDailyState,
} from "@freestyle/shared";

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const MAX_ATTEMPTS = 8;

const gameProfileSelect = {
  id: true,
  alias: true,
  birthYear: true,
  fmsParticipant: true,
  redBullInternational: true,
  country: { select: { code: true, name: true } },
  titles: { select: { competition: { select: { slug: true } } } },
} satisfies Prisma.FreestylerSelect;

const eligibleGameProfileSelect = {
  ...gameProfileSelect,
  _count: { select: { sources: true } },
} satisfies Prisma.FreestylerSelect;

export const dailyEligibleWhere = {
  catalogStatus: "PUBLISHED",
  birthYear: { not: null },
  sources: { some: {} },
  OR: [
    { fmsParticipant: true },
    { redBullInternational: true },
    { titles: { some: {} } },
    { participations: { some: {} } },
    { battlesAsCompetitor1: { some: {} } },
    { battlesAsCompetitor2: { some: {} } },
  ],
} satisfies Prisma.FreestylerWhereInput;

type GameProfile = Prisma.FreestylerGetPayload<{ select: typeof gameProfileSelect }>;

interface StoredAttemptResult {
  guesses: FreestylerDailyGuess[];
}

interface ChallengePayload {
  answerFreestylerId: string;
}

export class DailyGameError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function dateKeyFor(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function deterministicIndex(dateKey: string, size: number): number {
  if (size <= 0) throw new Error("No hay perfiles elegibles");
  const digest = createHash("sha256").update(`freestyler-daily:${dateKey}`).digest();
  return digest.readUInt32BE(0) % size;
}

function numericAttribute(guess: number, answer: number): DailyAttributeResult {
  const difference = Math.abs(guess - answer);
  return {
    value: guess,
    label: String(guess),
    status: difference === 0 ? "exact" : difference === 1 ? "close" : "miss",
    direction: difference === 0 ? undefined : answer > guess ? "higher" : "lower",
  };
}

export function compareFreestylers(guess: GameProfile, answer: GameProfile, dateKey: string): FreestylerDailyGuess {
  if (!guess.birthYear || !answer.birthYear) throw new Error("El perfil no tiene año de nacimiento");
  const podiumCompetitionSlugs = new Set(["fms", "red-bull-batalla", "god-level"]);
  const guessPodiums = guess.titles.filter((title) => podiumCompetitionSlugs.has(title.competition.slug)).length;
  const answerPodiums = answer.titles.filter((title) => podiumCompetitionSlugs.has(title.competition.slug)).length;

  return {
    freestylerId: guess.id,
    alias: guess.alias,
    isCorrect: guess.id === answer.id,
    attributes: {
      country: {
        value: guess.country.code,
        label: guess.country.name,
        status: guess.country.code === answer.country.code ? "exact" : "miss",
      },
      birthYear: numericAttribute(guess.birthYear, answer.birthYear),
      fmsParticipant: {
        value: Boolean(guess.fmsParticipant),
        label: guess.fmsParticipant ? "Sí" : "No",
        status: guess.fmsParticipant === answer.fmsParticipant ? "exact" : "miss",
      },
      redBullInternational: {
        value: Boolean(guess.redBullInternational),
        label: guess.redBullInternational ? "Sí" : "No",
        status: guess.redBullInternational === answer.redBullInternational ? "exact" : "miss",
      },
      podiums: numericAttribute(guessPodiums, answerPodiums),
      titles: numericAttribute(guess.titles.length, answer.titles.length),
    },
  };
}

function readPayload(payload: Prisma.JsonValue): ChallengePayload {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    typeof (payload as Record<string, Prisma.JsonValue>).answerFreestylerId !== "string"
  ) {
    throw new Error("El desafío diario tiene un payload inválido");
  }
  return { answerFreestylerId: (payload as Record<string, string>).answerFreestylerId };
}

function readStoredResult(result: Prisma.JsonValue | null): StoredAttemptResult {
  if (!result || typeof result !== "object" || Array.isArray(result)) return { guesses: [] };
  const guesses = (result as Record<string, Prisma.JsonValue>).guesses;
  if (!Array.isArray(guesses)) return { guesses: [] };

  return {
    guesses: (guesses as unknown as FreestylerDailyGuess[]).filter(
      (guess) => Boolean(guess.attributes?.birthYear && guess.attributes?.podiums),
    ),
  };
}

function sessionHash(sessionId: string) {
  const salt = process.env.SESSION_HASH_SALT || process.env.JWT_SECRET || "freestyle-arena-local";
  return createHash("sha256").update(`${salt}:${sessionId}`).digest("hex");
}

function validateSessionId(sessionId: unknown): string {
  if (typeof sessionId !== "string" || sessionId.length < 8 || sessionId.length > 128) {
    throw new DailyGameError("La sesión de juego no es válida", 400);
  }
  return sessionId;
}

async function eligibleProfiles(prisma: PrismaClient) {
  const profiles = await prisma.freestyler.findMany({
    where: dailyEligibleWhere,
    select: eligibleGameProfileSelect,
    orderBy: { slug: "asc" },
  });
  return profiles.filter((profile) => profile._count.sources >= 2);
}

async function getOrCreateChallenge(prisma: PrismaClient, now: Date) {
  const dateKey = dateKeyFor(now);
  const candidates = await eligibleProfiles(prisma);
  if (!candidates.length) throw new DailyGameError("No hay perfiles elegibles para el desafío", 503);
  const answer = candidates[deterministicIndex(dateKey, candidates.length)];
  const challenge = await prisma.dailyChallenge.upsert({
    where: { game_dateKey: { game: "FREESTYLER", dateKey } },
    update: {},
    create: {
      game: "FREESTYLER",
      dateKey,
      status: "PUBLISHED",
      validatedAt: now,
      payload: { answerFreestylerId: answer.id },
    },
  });
  return { challenge, dateKey };
}

async function buildState(
  prisma: PrismaClient,
  challengeId: string,
  dateKey: string,
  answerFreestylerId: string,
  hash?: string,
): Promise<FreestylerDailyState> {
  const attempt = hash
    ? await prisma.gameAttempt.findUnique({ where: { challengeId_sessionHash: { challengeId, sessionHash: hash } } })
    : null;
  const guesses = readStoredResult(attempt?.result ?? null).guesses;
  const state: FreestylerDailyState = {
    dateKey,
    maxAttempts: MAX_ATTEMPTS,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - guesses.length),
    completed: attempt?.completed ?? false,
    won: attempt?.won ?? null,
    guesses,
  };

  if (state.completed) {
    const answer = await prisma.freestyler.findUnique({
      where: { id: answerFreestylerId },
      select: { id: true, alias: true, country: { select: { name: true } } },
    });
    if (answer) state.answer = { id: answer.id, alias: answer.alias, country: answer.country.name };
  }

  return state;
}

export async function getFreestylerDailyState(prisma: PrismaClient, sessionId: unknown, now = new Date()) {
  const validSession = validateSessionId(sessionId);
  const { challenge, dateKey } = await getOrCreateChallenge(prisma, now);
  const payload = readPayload(challenge.payload);
  return buildState(prisma, challenge.id, dateKey, payload.answerFreestylerId, sessionHash(validSession));
}

export async function submitFreestylerDailyGuess(
  prisma: PrismaClient,
  sessionId: unknown,
  guessedFreestylerId: unknown,
  now = new Date(),
) {
  const validSession = validateSessionId(sessionId);
  if (typeof guessedFreestylerId !== "string" || !guessedFreestylerId) {
    throw new DailyGameError("Selecciona un freestyler válido", 400);
  }

  const { challenge, dateKey } = await getOrCreateChallenge(prisma, now);
  const payload = readPayload(challenge.payload);
  const hash = sessionHash(validSession);
  const [guess, answer, existingAttempt] = await Promise.all([
    prisma.freestyler.findFirst({
      where: { id: guessedFreestylerId, ...dailyEligibleWhere },
      select: eligibleGameProfileSelect,
    }),
    prisma.freestyler.findUnique({ where: { id: payload.answerFreestylerId }, select: gameProfileSelect }),
    prisma.gameAttempt.findUnique({ where: { challengeId_sessionHash: { challengeId: challenge.id, sessionHash: hash } } }),
  ]);

  if (!guess || guess._count.sources < 2) {
    throw new DailyGameError("Ese perfil todavía no es elegible para el juego", 400);
  }
  if (!answer) throw new DailyGameError("La respuesta del desafío ya no está disponible", 500);
  if (existingAttempt?.completed) throw new DailyGameError("La partida ya terminó", 409);

  const stored = readStoredResult(existingAttempt?.result ?? null);
  if (stored.guesses.some((item) => item.freestylerId === guess.id)) {
    throw new DailyGameError("Ya intentaste con ese freestyler", 409);
  }
  if (stored.guesses.length >= MAX_ATTEMPTS) throw new DailyGameError("No quedan intentos", 409);

  const comparison = compareFreestylers(guess, answer, dateKey);
  const guesses = [...stored.guesses, comparison];
  const completed = comparison.isCorrect || guesses.length >= MAX_ATTEMPTS;
  const won = comparison.isCorrect ? true : completed ? false : null;

  await prisma.gameAttempt.upsert({
    where: { challengeId_sessionHash: { challengeId: challenge.id, sessionHash: hash } },
    update: { attemptCount: guesses.length, completed, won, result: { guesses } as unknown as Prisma.InputJsonValue },
    create: {
      challengeId: challenge.id,
      sessionHash: hash,
      attemptCount: guesses.length,
      completed,
      won,
      result: { guesses } as unknown as Prisma.InputJsonValue,
    },
  });

  return buildState(prisma, challenge.id, dateKey, payload.answerFreestylerId, hash);
}
