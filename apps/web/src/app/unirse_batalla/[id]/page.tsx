"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Toaster, showToast } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_WS_URL || "";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; battleId: string };

export default function JoinBattlePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invite = searchParams.get("invite") || "";
  const [state, setState] = useState<State>({ status: "loading" });
  const [alias, setAlias] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!invite) {
      setState({ status: "error", message: "Enlace de invitación inválido. Pide un nuevo enlace al organizador." });
      return;
    }

    let cancelled = false;

    fetch(`${API_URL}/api/battles/${encodeURIComponent(params.id)}/invite?invite=${encodeURIComponent(invite)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const message = body.error || (res.status === 410 ? "La invitación ya fue usada o expiró." : res.status === 403 ? "La invitación no pertenece a esta sala." : "No se pudo validar la invitación.");
          if (!cancelled) setState({ status: "error", message });
          return;
        }
        const data = await res.json();
        if (!cancelled) setState({ status: "ready", battleId: data.battleId });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "No se pudo conectar con el servidor. Intenta de nuevo." });
      });

    return () => { cancelled = true; };
  }, [params.id, invite]);

  const handleJoin = () => {
    const trimmed = alias.trim();
    if (!trimmed) {
      showToast("Escribe tu alias primero", "error");
      return;
    }
    if (state.status !== "ready") return;
    setJoining(true);
    sessionStorage.setItem(`battle_pending_${state.battleId}`, JSON.stringify({ alias: trimmed, inviteToken: invite }));
    router.push(`/battle/${state.battleId}`);
  };

  return (
    <div className="min-h-[calc(100vh-57px)] flex items-center justify-center">
      <Toaster />

      {state.status === "loading" && (
        <div className="text-center px-4">
          <p className="text-xs font-semibold tracking-[0.4em] uppercase text-white/20 animate-pulse">
            Validando invitación...
          </p>
        </div>
      )}

      {state.status === "error" && (
        <div className="max-w-md mx-auto w-full px-4 py-12 text-center animate-slide-up">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-battle text-white mb-3">Invitación no válida</h2>
          <p className="text-gray-400 mb-8">{state.message}</p>
          <a
            href="/"
            className="inline-block px-8 py-3 font-battle font-black italic uppercase tracking-wider transition-all"
            style={{ background: "#e30613", color: "white" }}
          >
            Volver al inicio
          </a>
        </div>
      )}

      {state.status === "ready" && (
        <div className="max-w-lg mx-auto w-full px-4 py-12 animate-slide-up">
          <a href="/" className="text-gray-500 hover:text-white transition mb-8 flex items-center gap-1">
            <span>←</span> Volver
          </a>

          <h2 className="text-3xl font-battle text-white mb-2">Unirse a la batalla</h2>
          <p className="text-gray-400 mb-8">
            Escribe tu alias para entrar. El admin de la sala te asignará un rol.
          </p>

          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-2">Tu alias</label>
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
              maxLength={24}
              placeholder="Ej: MC Lírico, Dtoke, Aczino..."
              className="w-full px-4 py-4 bg-arena-800 border border-gray-700 rounded-xl text-white placeholder-gray-600 focus:border-red-500 focus:outline-none text-lg"
              autoFocus
            />
          </div>

          <button
            onClick={handleJoin}
            disabled={joining || !alias.trim()}
            className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 rounded-xl font-bold text-white text-lg transition"
          >
            {joining ? "Entrando..." : "Entrar a la batalla"}
          </button>
        </div>
      )}
    </div>
  );
}
