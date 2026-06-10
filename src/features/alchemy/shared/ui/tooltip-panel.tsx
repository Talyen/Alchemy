// Shared hover tooltip container with standard header/subheader/body/section slots.
// Provides consistent styling across all tooltips — enemy, card, keyword, status, map, etc.
// Width is configurable via the `width` prop (defaults to w-60).
/* eslint-disable react-refresh/only-export-components */
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { popupClassName } from "../config";

type TooltipPanelProps = {
  children: ReactNode;
  width?: string;
  className?: string;
  flip?: boolean;
  /** Runtime placement offsets from `useTooltipFlip` / enemy tooltip anchoring — not for theme colors. */
  style?: CSSProperties | undefined;
  ref?: React.Ref<HTMLDivElement>;
};

export function TooltipPanel({ children, width = "w-60", className, flip, style, ref }: TooltipPanelProps) {
  return (
    <div
      ref={ref}
      className={cn(popupClassName, width, "hover-popup-panel pointer-events-none", className)}
      style={style}
      data-flip={flip ? "below" : "above"}
    >
      {children}
    </div>
  );
}

// Standard layout measurement hook for tooltips that flip below if clipping.
export function useTooltipFlip(trigger?: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setFlip(rect.top < 0);
  }, [trigger]);

  return { ref, flip };
}

// Flips below when clipped above the viewport and shifts horizontally to stay on-screen.
export function useTooltipViewportClamp(padding = 8, trigger?: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  const [dx, setDx] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    setFlip(rect.top < 0);

    let horizontalShift = 0;
    if (rect.left < 0) {
      horizontalShift = -rect.left + padding;
    } else if (rect.right > window.innerWidth) {
      horizontalShift = window.innerWidth - rect.right - padding;
    }
    setDx(horizontalShift !== 0 ? horizontalShift : 0);
  }, [padding, trigger]);

  return { ref, flip, dx };
}

export function TooltipHeader({ children }: { children: ReactNode }) {
  return <p className="font-display text-lg font-bold text-foreground mb-1">{children}</p>;
}

export function TooltipSubheader({ children }: { children: ReactNode }) {
  return <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-widest text-amber-100/80">{children}</p>;
}

export function TooltipBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-1 space-y-1.5 text-sm leading-6 text-muted-foreground", className)}>{children}</div>;
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
