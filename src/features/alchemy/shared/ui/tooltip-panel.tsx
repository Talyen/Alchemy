// Shared hover tooltip container with standard header/subheader/body/section slots.
// Provides consistent styling across all tooltips — enemy, card, keyword, status, map, etc.
// Width is configurable via the `width` prop (defaults to tooltipWidthClass).
import { type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  popupBaseClassName,
  tooltipAnchorClassNames,
  tooltipBodyClass,
  tooltipFooterChipClass,
  tooltipHeaderClass,
  tooltipSubheaderClass,
  tooltipWidthClass,
} from "../config";

export type TooltipPlacement = "above" | "below" | "side-start" | "side-end";

interface TooltipPanelProps {
  children: ReactNode;
  width?: string;
  className?: string;
  flip?: boolean;
  placement?: TooltipPlacement;
  /** State-driven tooltips that are not inside a hover group. */
  visible?: boolean;
  /** Runtime placement offsets from portaled tooltip anchoring — not for theme colors. */
  style?: CSSProperties | undefined;
  ref?: React.Ref<HTMLDivElement>;
}

function tooltipAnchorClass(placement: TooltipPlacement): string {
  if (placement === "below") return tooltipAnchorClassNames.below;
  if (placement === "above") return tooltipAnchorClassNames.above;
  return "";
}

export function TooltipPanel({
  children,
  width = tooltipWidthClass,
  className,
  flip,
  placement = "above",
  visible,
  style,
  ref,
}: TooltipPanelProps) {
  const resolvedPlacement: TooltipPlacement = flip ? "below" : placement;

  return (
    <div
      ref={ref}
      className={cn(
        popupBaseClassName,
        tooltipAnchorClass(resolvedPlacement),
        width,
        "hover-popup-panel pointer-events-none",
        className,
      )}
      style={style}
      data-placement={resolvedPlacement}
      data-flip={flip ? "below" : "above"}
      {...(visible ? { "data-visible": true } : {})}
    >
      {children}
    </div>
  );
}

export function TooltipHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn(tooltipHeaderClass, className)}>{children}</p>;
}

export function TooltipSubheader({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p className={cn(tooltipSubheaderClass, className)} style={style}>
      {children}
    </p>
  );
}

export function TooltipBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(tooltipBodyClass, className)}>{children}</div>;
}

export function TooltipSeparator({ className }: { className?: string }) {
  return <div className={cn("border-t border-border/60 pt-3", className)} />;
}

export function TooltipSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <TooltipSubheader>{label}</TooltipSubheader>
      {children}
    </div>
  );
}

export function TooltipChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "mt-1.5 inline-flex items-center rounded-full bg-amber-100/10 px-1.5 py-px tracking-wider text-amber-100/80 uppercase",
        tooltipFooterChipClass,
        className,
      )}
    >
      {children}
    </span>
  );
}
