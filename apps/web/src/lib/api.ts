import type { Battle, BattleModeConfig } from "@freestyle/shared";

const API_URL = process.env.NEXT_PUBLIC_WS_URL || "";

export async function createBattle(mode?: Partial<BattleModeConfig>): Promise<Battle> {
  const res = await fetch(`${API_URL}/api/battles`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error("No se pudo crear la batalla");
  return res.json();
}
