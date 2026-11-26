"use client";

import Image from "next/image";
import { useState } from "react";
import type { Battle } from "@freestyle/shared";
import { createPostBattlePoster, createPreBattlePoster, downloadBattlePoster, type BattlePosterPreview } from "@/lib/battlePoster";
import { Alert, Button, Dialog } from "./ui";

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
      <Button type="button" variant="secondary" className={triggerClassName} onClick={showPreview}>{triggerLabel}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={variant === "pre" ? "Cartelera previa" : "Resultado de batalla"} className="max-w-[940px]">
        <div className="poster-preview">
          {!preview && !error && <span className="poster-loading">Generando cartelera...</span>}
          {error && <Alert variant="error">{error}</Alert>}
          {preview && <Image src={preview.dataUrl} alt="Vista previa de la cartelera que se descargará" width={540} height={675} unoptimized priority />}
        </div>
        <div className="poster-dialog-actions">
          <p>La imagen incluirá <strong>{process.env.NEXT_PUBLIC_SITE_URL || "el dominio de esta página"}</strong>.</p>
          <Button type="button" size="lg" disabled={!preview} onClick={() => preview && downloadBattlePoster(preview)}>Descargar PNG</Button>
        </div>
      </Dialog>
    </>
  );
}
