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
  placement?: TooltipPlacement;

  visible?: boolean;

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
  placement = "above",
  visible,
  style,
  ref,
}: TooltipPanelProps) {
  return (
    <div
      ref={ref}
      className={cn(
        popupBaseClassName,
        tooltipAnchorClass(placement),
        width,
        "hover-popup-panel pointer-events-none",
        className,
      )}
      style={style}
      data-placement={placement}
      {...(visible ? { "data-visible": true } : {})}
    >
      {children}
    </div>
  );
}

export function TooltipHeader({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <p className={cn(tooltipHeaderClass, className)}>{children}</p>;
}

export function TooltipSubheader({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  return (
    <p className={cn(tooltipSubheaderClass, className)} style={style}>
      {children}
    </p>
  );
}

export function TooltipBody({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <div className={cn(tooltipBodyClass, className)}>{children}</div>;
}

export function TooltipSeparator({ className }: { className?: string | undefined }) {
  return <div className={cn("my-2 border-t border-border/60", className)} />;
}

export function TooltipSection({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children?: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={className}>
      <TooltipSubheader className="mt-0">{label}</TooltipSubheader>
      {children}
    </div>
  );
}

export function TooltipChip({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-amber-100/10 px-1.5 py-px tracking-wider text-amber-100/80 uppercase",
        tooltipFooterChipClass,
        className,
      )}
    >
      {children}
    </span>
  );
}
