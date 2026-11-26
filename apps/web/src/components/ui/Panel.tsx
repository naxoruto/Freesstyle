import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type PanelProps = ({ as?: "div" } & HTMLAttributes<HTMLDivElement>) | ({ as: "section" } & HTMLAttributes<HTMLElement>);

const panelClassName = (className?: string) => cn("rounded-[var(--radius-panel)] border border-arena-border bg-arena-surface/70 p-4 sm:p-5", className);

export function Panel(props: PanelProps) {
  const Component = props.as ?? "div";
  const attributes = { ...props };
  delete attributes.as;
  const { className, ...elementProps } = attributes;
  return <Component {...elementProps} className={panelClassName(className)} />;
}
