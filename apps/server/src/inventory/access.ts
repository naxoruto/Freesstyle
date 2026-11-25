import { createHash, timingSafeEqual } from "node:crypto";

export function authorizeInventory(configuredSecret: string | undefined, authorization: string | undefined): boolean {
  if (!configuredSecret || configuredSecret.length < 32 || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7);
  if (!supplied) return false;
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(configuredSecret), digest(supplied));
}
