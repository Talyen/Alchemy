import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from "@floating-ui/dom";

export type PortaledTooltipSide = "side-start" | "side-end";

export type PortaledTooltipPlacement = "above" | PortaledTooltipSide;

const VR_STAGE_SELECTOR = '[data-testid="vr-stage"]';
const DEFAULT_HORIZONTAL_INSET = 152;

function getVrStageElement(): Element {
  return document.querySelector(VR_STAGE_SELECTOR) ?? document.documentElement;
}

export function horizontalInsetForStage(stage: Pick<DOMRect, "left" | "right">): number {
  return Math.min(DEFAULT_HORIZONTAL_INSET, Math.max(48, (stage.right - stage.left) / 4));
}

export function preferredFloatingPlacement(placement: PortaledTooltipPlacement): Placement {
  if (placement === "side-start") return "left";
  if (placement === "side-end") return "right";
  return "top";
}

export function floatingPlacementToTooltipState(finalPlacement: Placement): {
  placeBelow: boolean;
  tooltipSide: PortaledTooltipSide | null;
} {
  const side = finalPlacement.split("-")[0];
  if (side === "bottom") return { placeBelow: true, tooltipSide: null };
  if (side === "left") return { placeBelow: false, tooltipSide: "side-start" };
  if (side === "right") return { placeBelow: false, tooltipSide: "side-end" };
  return { placeBelow: false, tooltipSide: null };
}

export function usePortaledTooltipPlacement(
  triggerRef: RefObject<HTMLElement | null>,
  active: boolean,
  padding = 8,
  placement: PortaledTooltipPlacement = "above",
  maxWidthFraction?: number,
) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [placeBelow, setPlaceBelow] = useState(false);
  const [tooltipSide, setTooltipSide] = useState<PortaledTooltipSide | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const tooltipEl = tooltipRef.current;
    if (!active || !trigger || !tooltipEl) {
      if (tooltipEl) tooltipEl.style.width = "";
      setTooltipStyle(undefined);
      return;
    }

    let cancelled = false;
    let needsSizing = true;
    let sizedWidth = 0;
    let sizedHeight = 0;

    const update = () => {
      if (cancelled) return;
      const stage = getVrStageElement();
      const bounds = stage.getBoundingClientRect();
      const horizontalInset = horizontalInsetForStage(bounds);
      if (needsSizing || bounds.width !== sizedWidth || bounds.height !== sizedHeight) {
        needsSizing = false;
        sizedWidth = bounds.width;
        sizedHeight = bounds.height;
        tooltipEl.style.width = "";
        tooltipEl.style.maxWidth = "";
        const preferredMax = parseFloat(getComputedStyle(tooltipEl).maxWidth);
        const availableWidth = Math.max(
          0,
          Math.min(bounds.width - 2 * horizontalInset, maxWidthFraction ? bounds.width * maxWidthFraction : Infinity),
        );
        tooltipEl.style.maxWidth = `${Math.min(Number.isFinite(preferredMax) ? preferredMax : availableWidth, availableWidth)}px`;
        if (tooltipEl.getBoundingClientRect().height > bounds.height - 2 * padding) {
          tooltipEl.style.maxWidth = `${availableWidth}px`;
          tooltipEl.style.width = `${availableWidth}px`;
        }
      }
      void computePosition(trigger, tooltipEl, {
        placement: preferredFloatingPlacement(placement),
        strategy: "fixed",
        middleware: [
          offset(padding),
          flip({
            boundary: stage,
            fallbackPlacements: placement === "above" ? ["bottom", "left", "right"] : undefined,
          }),
          shift({
            boundary: stage,
            padding: { top: padding, bottom: padding, left: horizontalInset, right: horizontalInset },
          }),
        ],
      }).then(({ x, y, placement: finalPlacement }) => {
        if (cancelled) return;
        const state = floatingPlacementToTooltipState(finalPlacement);
        setPlaceBelow(state.placeBelow);
        setTooltipSide(state.tooltipSide);
        const left = `${x}px`;
        const top = `${y}px`;
        setTooltipStyle((previous) => (previous?.left === left && previous.top === top ? previous : { left, top }));
      });
    };

    update();
    let frame: number | null = null;
    const scheduleUpdate = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        update();
      });
    };
    const cleanup = autoUpdate(trigger, tooltipEl, scheduleUpdate, { elementResize: false });
    const stage = getVrStageElement();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            if (entries.some((entry) => entry.target !== trigger)) needsSizing = true;
            scheduleUpdate();
          });
    observer?.observe(stage);
    observer?.observe(tooltipEl);
    observer?.observe(trigger);
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      cleanup();
    };
  }, [active, triggerRef, padding, placement, maxWidthFraction]);

  return { tooltipRef, placeBelow, tooltipSide, tooltipStyle };
}
