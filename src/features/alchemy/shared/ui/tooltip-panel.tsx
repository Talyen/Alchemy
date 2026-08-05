// Shared hover tooltip container with standard header/subheader/body/section slots.
// Provides consistent styling across all tooltips — enemy, card, keyword, status, map, etc.
// Width is configurable via the `width` prop (defaults to w-72).
/* eslint-disable react-refresh/only-export-components -- exports TooltipPanel plus measurement helpers from same module */
import { type CSSProperties, type MouseEventHandler, type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  popupBaseClassName,
  tooltipAnchorClassNames,
  tooltipBodyClass,
  tooltipHeaderClass,
  tooltipSubheaderClass,
} from "../config";
import { getVrStageBounds } from "./portaled-tooltip-placement";

export type TooltipPlacement = "above" | "below" | "side-start" | "side-end";

interface TooltipPanelProps {
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
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
}

function tooltipAnchorClass(placement: TooltipPlacement): string {
  if (placement === "below") return tooltipAnchorClassNames.below;
  if (placement === "above") return tooltipAnchorClassNames.above;
  return "";
}

export function TooltipPanel({
  children,
  width = "w-72",
  className,
  flip,
  placement = "above",
  visible,
  style,
  ref,
  onMouseEnter,
  onMouseLeave,
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-placement={resolvedPlacement}
      data-flip={flip ? "below" : "above"}
      {...(visible ? { "data-visible": true } : {})}
    >
      {children}
    </div>
  );
}

export type TooltipClipBounds = Pick<DOMRect, "top" | "left" | "right" | "bottom">;

export function measureTooltipPlacement(
  rect: Pick<DOMRect, "top" | "left" | "right">,
  padding: number,
  bounds: TooltipClipBounds = getVrStageBounds(),
): { flip: boolean; dx: number } {
  const flip = rect.top < bounds.top + padding;

  let horizontalShift = 0;
  if (rect.left < bounds.left + padding) {
    horizontalShift = bounds.left + padding - rect.left;
  } else if (rect.right > bounds.right - padding) {
    horizontalShift = bounds.right - padding - rect.right;
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
    const bounds = getVrStageBounds();

    if (!flip && rect.top < bounds.top + padding) {
      setFlip(true);
      return;
    }

    const { dx: nextDx } = measureTooltipPlacement(rect, padding, bounds);
    setDx(nextDx);
  }, [flip, padding, trigger]);

  return { ref, flip, dx };
}

// Standard layout measurement hook for tooltips that flip below if clipping.
export function useTooltipFlip(trigger?: unknown) {
  const { ref, flip } = useTooltipPlacementMeasure(8, trigger);
  return { ref, flip };
}

// Flips below when clipped above the stage and shifts horizontally to stay on-stage.
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

// Picks side-start or side-end based on stage clipping; does not flip above/below.
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
    const bounds = getVrStageBounds();

    if (placement === "side-end" && rect.left < bounds.left + padding) {
      setPlacement("side-start");
      return;
    }

    if (placement === "side-start" && rect.right > bounds.right - padding) {
      setPlacement("side-end");
      return;
    }

    if (
      (placement === "side-start" || placement === "side-end") &&
      rect.left < bounds.left + padding &&
      rect.right > bounds.right - padding
    ) {
      setPlacement(preferred);
    }
  }, [placement, padding, preferred, trigger]);

  return { ref, placement };
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
