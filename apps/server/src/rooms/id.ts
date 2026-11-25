import { randomInt } from "node:crypto";

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Identificador corto legible para salas y torneos.
 *
 * 8 caracteres base36 ≈ 41 bits (frente a los 32 bits del hex de 8 caracteres),
 * suficiente para códigos de sala sin colisiones relevantes y compatible con la
 * normalización a minúsculas ya existente (`toLowerCase`).
 */
export function generateShortId(length = 8): string {
  let id = "";
  for (let i = 0; i < length; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return id;
}
