"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Toaster, showToast } from "@/lib/utils";
import { Alert, Button, ButtonLink, Panel, TextField } from "@/components/ui";

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
          <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
          <h2 className="text-2xl font-battle text-white mb-3">Invitación no válida</h2>
          <Alert variant="error" className="mb-8">{state.message}</Alert>
          <ButtonLink href="/" size="lg">
            Volver al inicio
          </ButtonLink>
        </div>
      )}

      {state.status === "ready" && (
        <div className="max-w-lg mx-auto w-full px-4 py-12 animate-slide-up">
          <ButtonLink href="/" variant="ghost" size="sm" className="mb-8"><span aria-hidden="true">←</span> Volver</ButtonLink>

          <h2 className="text-3xl font-battle text-white mb-2">Unirse a la batalla</h2>
          <p className="text-gray-400 mb-8">
            Escribe tu alias para entrar. El admin de la sala te asignará un rol.
          </p>

          <Panel className="mb-8">
            <TextField
              label="Tu alias"
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
              maxLength={24}
              placeholder="Ej: MC Lírico, Dtoke, Aczino..."
              size="lg"
              autoFocus
            />
          </Panel>

          <Button onClick={handleJoin} disabled={joining || !alias.trim()} fullWidth size="lg">
            {joining ? "Entrando..." : "Entrar a la batalla"}
          </Button>
        </div>
      )}
    </div>
  );
}
