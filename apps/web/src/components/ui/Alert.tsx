import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

const variants = {
  info: "border-sky-300/25 bg-sky-950/30 text-sky-100",
  success: "border-emerald-300/25 bg-emerald-950/30 text-emerald-100",
  warning: "border-amber-300/25 bg-amber-950/30 text-amber-100",
  error: "border-red-300/25 bg-red-950/30 text-red-100",
} as const;

export function Alert({ variant = "info", className, children, ...props }: HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof variants; children: ReactNode }) {
  return <div {...props} role={variant === "error" ? "alert" : "status"} className={cn("rounded-[var(--radius-control)] border px-4 py-3 text-sm", variants[variant], className)}>{children}</div>;
}
