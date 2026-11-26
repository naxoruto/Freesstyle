"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { cn } from "./cn";

export function Dialog({ open, onClose, title, children, className }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollY = window.scrollY;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus({ preventScroll: true });
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      className={cn("m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-[var(--radius-panel)] border border-arena-border bg-arena-canvas p-0 text-white shadow-2xl backdrop:bg-black/80", className)}>
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col" onClick={event => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-arena-border px-5 py-4">
          <h2 id={titleId} className="font-battle text-2xl font-black uppercase">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} autoFocus aria-label={`Cerrar ${title}`}>Cerrar ✕</Button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>, document.body,
  );
}
