export function validateProductionConfig(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== "production") return;
  const missing: string[] = [];
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.INVENTORY_ADMIN_TOKEN || env.INVENTORY_ADMIN_TOKEN.length < 32) missing.push("INVENTORY_ADMIN_TOKEN (mínimo 32 caracteres)");
  if (!env.SESSION_HASH_SALT || env.SESSION_HASH_SALT.length < 32) missing.push("SESSION_HASH_SALT (mínimo 32 caracteres)");
  const origins = env.ALLOWED_ORIGINS?.split(",").map(origin => origin.trim()).filter(Boolean) ?? [];
  if (!origins.length || origins.some(origin => {
    try { const parsed = new URL(origin); return parsed.origin !== origin || parsed.protocol !== "https:"; }
    catch { return true; }
  })) missing.push("ALLOWED_ORIGINS (orígenes HTTPS separados por comas)");
  if (missing.length) throw new Error(`Configuración de producción incompleta: ${missing.join(", ")}`);
}
