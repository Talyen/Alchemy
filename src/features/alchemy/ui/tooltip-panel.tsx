// Shared hover tooltip container with standard header/subheader/body/section slots.
// Provides consistent styling across all tooltips — enemy, card, keyword, status, map, etc.
// Width is configurable via the `width` prop (defaults to w-60).
/* eslint-disable react-refresh/only-export-components */
import { forwardRef, type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { popupClassName } from "../config";
import { DescriptionLines } from "./card-description-ui";

type TooltipPanelProps = {
  children: ReactNode;
  width?: string;
  className?: string;
  flip?: boolean;
  style?: CSSProperties;
};

export const TooltipPanel = forwardRef<HTMLDivElement, TooltipPanelProps>(function TooltipPanel(
  { children, width = "w-60", className, flip, style },
  ref,
) {
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
});

// Standard layout measurement hook for tooltips that flip below if clipping.
export function useTooltipFlip(deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 0) setFlip(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, flip };
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

export function TooltipBodyLine({ line, idPrefix }: { line: string; idPrefix: string }) {
  return <DescriptionLines lines={[line]} idPrefix={idPrefix} />;
}
