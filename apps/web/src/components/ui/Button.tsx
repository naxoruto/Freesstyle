import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "option";
export type ButtonSize = "sm" | "md" | "lg";

interface SharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

const styles: Record<ButtonVariant, string> = {
  primary: "border border-transparent bg-arena-signal text-white hover:bg-arena-signal-hover",
  secondary: "border border-white/20 bg-transparent text-white hover:border-white/50 hover:bg-white/5",
  ghost: "border border-transparent bg-transparent text-white/65 hover:bg-white/5 hover:text-white",
  danger: "border border-red-500/35 bg-red-950/30 text-red-300 hover:border-red-400/60 hover:bg-red-950/60",
  option: "w-full border border-white/10 bg-white/[0.02] text-left text-white/75 hover:border-white/30 hover:bg-white/[0.05] aria-pressed:border-arena-signal aria-pressed:bg-arena-signal/10 aria-pressed:text-white",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

type ButtonStyleProps = Pick<SharedProps, "variant" | "size" | "fullWidth" | "className">;

export function buttonClassName({ variant = "primary", size = "md", fullWidth = false, className }: ButtonStyleProps) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arena-focus focus-visible:ring-offset-2 focus-visible:ring-offset-arena-canvas disabled:pointer-events-none disabled:opacity-40",
    styles[variant],
    variant === "option" ? "p-4" : sizes[size],
    fullWidth && "w-full",
    className,
  );
}

type ButtonProps = SharedProps & ButtonHTMLAttributes<HTMLButtonElement>;
export function Button({ variant, size, fullWidth, className, type = "button", children, ...props }: ButtonProps) {
  return <button {...props} type={type} className={buttonClassName({ variant, size, fullWidth, className })}>{children}</button>;
}

type ButtonLinkProps = SharedProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
export function ButtonLink({ variant, size, fullWidth, className, href, children, ...props }: ButtonLinkProps) {
  return <Link {...props} href={href} className={buttonClassName({ variant, size, fullWidth, className })}>{children}</Link>;
}
