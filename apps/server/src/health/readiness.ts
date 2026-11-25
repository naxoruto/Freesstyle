export type Readiness =
  | { status: "ready"; database: "ok" }
  | { status: "unavailable"; database: "unavailable" };

export async function checkReadiness(checkDatabase: () => Promise<unknown>): Promise<Readiness> {
  try {
    await checkDatabase();
    return { status: "ready", database: "ok" };
  } catch {
    return { status: "unavailable", database: "unavailable" };
  }
}
