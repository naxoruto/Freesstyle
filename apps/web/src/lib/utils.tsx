"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let toastId = 0;
const toastListeners: Set<(toast: Toast) => void> = new Set();

export function showToast(message: string, type: Toast["type"] = "info") {
  const toast = { id: ++toastId, message, type };
  toastListeners.forEach((fn) => fn(toast));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3500);
    };
    toastListeners.add(handler);
    return () => { toastListeners.delete(handler); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
            t.type === "success"
              ? "bg-green-600 text-white"
              : t.type === "error"
              ? "bg-red-600 text-white"
              : "bg-arena-800 text-white border border-gray-700"
          }`}
        >
          {t.type === "success" && "✅ "}
          {t.type === "error" && "❌ "}
          {t.type === "info" && "ℹ️ "}
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text: string) => {
    setCopied(false);
    try {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const x = window.scrollX, y = window.scrollY;
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.readOnly = true;
        ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        try {
          ta.focus({ preventScroll: true });
          ta.select();
          if (!document.execCommand("copy")) throw new Error("No se pudo copiar");
        } finally {
          ta.remove();
          active?.focus({ preventScroll: true });
          window.scrollTo({ left: x, top: y, behavior: "instant" });
        }
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      showToast("No se pudo copiar. Revisa los permisos del portapapeles.", "error");
      return false;
    }
  }, []);

  return { copied, copy };
}
