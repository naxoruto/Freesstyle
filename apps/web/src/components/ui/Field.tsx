import { useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

interface SharedFieldProps {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  className?: string;
  controlClassName?: string;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return <label htmlFor={htmlFor} className="block text-sm font-medium text-white/75">{children}</label>;
}

function FieldHelp({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  const message = error || hint;
  if (!message) return null;
  return <p id={`${id}-help`} className={cn("mt-1.5 text-xs", error ? "text-red-300" : "text-white/45")}>
    {message}
  </p>;
}

const fieldBase = "mt-2 w-full rounded-[var(--radius-control)] border border-arena-border bg-arena-surface px-3.5 text-white placeholder:text-white/30 transition-colors focus:border-arena-signal focus:outline-none focus:ring-2 focus:ring-arena-signal/25 disabled:cursor-not-allowed disabled:opacity-50";

type TextFieldProps = SharedFieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "md" | "lg" };

export function TextField({ label, hint, error, id, className, controlClassName, size = "md", ...props }: TextFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div className={className}>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      <input
        {...props}
        id={controlId}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || error ? `${controlId}-help` : undefined}
        className={cn(fieldBase, size === "lg" ? "min-h-14 text-lg" : "min-h-11 text-sm", controlClassName)}
      />
      <FieldHelp id={controlId} hint={hint} error={error} />
    </div>
  );
}

export function TextArea({ label, hint, error, id, className, controlClassName, rows = 4, ...props }: SharedFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div className={className}>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      <textarea
        {...props}
        id={controlId}
        rows={rows}
        aria-invalid={!!error || undefined}
        aria-describedby={hint || error ? `${controlId}-help` : undefined}
        className={cn(fieldBase, "min-h-28 py-3 text-sm", controlClassName)}
      />
      <FieldHelp id={controlId} hint={hint} error={error} />
    </div>
  );
}
