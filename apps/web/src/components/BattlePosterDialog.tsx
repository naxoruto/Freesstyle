"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Battle } from "@freestyle/shared";
import { createPostBattlePoster, createPreBattlePoster, downloadBattlePoster, type BattlePosterPreview } from "@/lib/battlePoster";

interface BattlePosterDialogProps {
  battle: Battle;
  variant: "pre" | "post";
  triggerLabel: string;
  triggerClassName: string;
}

export function BattlePosterDialog({ battle, variant, triggerLabel, triggerClassName }: BattlePosterDialogProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<BattlePosterPreview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const showPreview = async () => {
    setOpen(true);
    setPreview(null);
    setError("");
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const result = variant === "pre"
        ? await createPreBattlePoster(battle, siteUrl)
        : await createPostBattlePoster(battle, siteUrl);
      setPreview(result);
    } catch {
      setError("No se pudo generar la vista previa. Intenta nuevamente.");
    }
  };

  return (
    <>
      <button type="button" className={triggerClassName} onClick={showPreview}>{triggerLabel}</button>
      {open && (
        <div className="poster-modal" role="dialog" aria-modal="true" aria-labelledby="poster-title" onMouseDown={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <div className="poster-dialog">
            <div className="poster-dialog-head">
              <div>
                <span>Vista previa</span>
                <h2 id="poster-title">{variant === "pre" ? "Cartelera previa" : "Resultado de batalla"}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar vista previa" autoFocus>Cerrar</button>
            </div>
            <div className="poster-preview">
              {!preview && !error && <span className="poster-loading">Generando cartelera...</span>}
              {error && <p role="alert">{error}</p>}
              {preview && <Image src={preview.dataUrl} alt="Vista previa de la cartelera que se descargará" width={540} height={675} unoptimized priority />}
            </div>
            <div className="poster-dialog-actions">
              <p>La imagen incluirá <strong>{process.env.NEXT_PUBLIC_SITE_URL || "el dominio de esta página"}</strong>.</p>
              <button type="button" disabled={!preview} onClick={() => preview && downloadBattlePoster(preview)}>Descargar PNG</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
