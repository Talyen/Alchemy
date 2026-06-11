// Shared hover tooltip container with standard header/subheader/body/section slots.
// Provides consistent styling across all tooltips — enemy, card, keyword, status, map, etc.
// Width is configurable via the `width` prop (defaults to w-60).
/* eslint-disable react-refresh/only-export-components */
import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { popupBaseClassName, tooltipAnchorClassNames } from "../config";

export type TooltipPlacement = "above" | "below" | "side-start" | "side-end";

type TooltipPanelProps = {
  children: ReactNode;
  width?: string;
  className?: string;
  flip?: boolean;
  placement?: TooltipPlacement;
  /** State-driven tooltips that are not inside a hover group. */
  visible?: boolean;
  /** Runtime placement offsets from `useTooltipFlip` / enemy tooltip anchoring — not for theme colors. */
  style?: CSSProperties | undefined;
  ref?: React.Ref<HTMLDivElement>;
};

function tooltipAnchorClass(placement: TooltipPlacement): string {
  if (placement === "below") return tooltipAnchorClassNames.below;
  if (placement === "above") return tooltipAnchorClassNames.above;
  return "";
}

export function TooltipPanel({
  children,
  width = "w-60",
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

export function measureTooltipPlacement(
  rect: Pick<DOMRect, "top" | "left" | "right">,
  padding: number,
  viewportWidth = window.innerWidth,
): { flip: boolean; dx: number } {
  const flip = rect.top < padding;

  let horizontalShift = 0;
  if (rect.left < padding) {
    horizontalShift = -rect.left + padding;
  } else if (rect.right > viewportWidth - padding) {
    horizontalShift = viewportWidth - rect.right - padding;
  }

  return { flip, dx: horizontalShift !== 0 ? horizontalShift : 0 };
}

function useTooltipPlacementMeasure(padding: number, trigger?: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  const [dx, setDx] = useState(0);
  const [prevTrigger, setPrevTrigger] = useState(trigger);

  if (trigger !== prevTrigger) {
    setPrevTrigger(trigger);
    setFlip(false);
    setDx(0);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();

    if (!flip && rect.top < padding) {
      setFlip(true);
      return;
    }

    const { dx: nextDx } = measureTooltipPlacement(rect, padding);
    setDx(nextDx);
  }, [flip, padding, trigger]);

  return { ref, flip, dx };
}

// Standard layout measurement hook for tooltips that flip below if clipping.
export function useTooltipFlip(trigger?: unknown) {
  const { ref, flip } = useTooltipPlacementMeasure(8, trigger);
  return { ref, flip };
}

// Flips below when clipped above the viewport and shifts horizontally to stay on-screen.
export function useTooltipViewportClamp(padding = 8, trigger?: unknown) {
  const { ref, flip, dx } = useTooltipPlacementMeasure(padding, trigger);
  return { ref, flip, dx };
}

type SidePlacement = Extract<TooltipPlacement, "side-start" | "side-end">;

/** Absolute positioning classes for tooltips beside their anchor (overrides popupBaseClassName left-1/2). */
export function tooltipSideAnchorClass(placement: SidePlacement): string {
  return placement === "side-start"
    ? "absolute left-[calc(100%+1rem)] top-1/2 right-auto bottom-auto"
    : "absolute right-[calc(100%+1rem)] top-1/2 left-auto bottom-auto";
}

// Picks side-start or side-end based on viewport clipping; does not flip above/below.
export function useTooltipSidePlacement(preferred: SidePlacement, trigger?: unknown, padding = 8) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<SidePlacement>(preferred);
  const [prevTrigger, setPrevTrigger] = useState(trigger);

  if (trigger !== prevTrigger) {
    setPrevTrigger(trigger);
    setPlacement(preferred);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();

    if (placement === "side-end" && rect.left < padding) {
      setPlacement("side-start");
      return;
    }

    if (placement === "side-start" && rect.right > window.innerWidth - padding) {
      setPlacement("side-end");
      return;
    }

    if (
      (placement === "side-start" || placement === "side-end") &&
      rect.left < padding &&
      rect.right > window.innerWidth - padding
    ) {
      setPlacement(preferred);
    }
  }, [placement, padding, preferred, trigger]);

  return { ref, placement };
}

// Above unless top-clipped, then below; if below clips the viewport bottom, use side placement.
export function useTooltipPlacementWithSideFallback(side: "left" | "right", padding = 8, trigger?: unknown) {
  const sidePlacement: TooltipPlacement = side === "left" ? "side-start" : "side-end";
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<TooltipPlacement>("above");
  const [dx, setDx] = useState(0);
  const [prevTrigger, setPrevTrigger] = useState(trigger);

  if (trigger !== prevTrigger) {
    setPrevTrigger(trigger);
    setPlacement("above");
    setDx(0);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();

    if (placement === "above" && rect.top < padding) {
      setPlacement("below");
      return;
    }

    if (placement === "below" && rect.bottom > window.innerHeight - padding) {
      setPlacement(sidePlacement);
      return;
    }

    const { dx: nextDx } = measureTooltipPlacement(rect, padding);
    setDx(nextDx);
  }, [padding, placement, sidePlacement, trigger]);

  return { ref, placement, flip: placement === "below", dx };
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
