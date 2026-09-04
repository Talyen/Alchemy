import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from "@floating-ui/dom";

export type PortaledTooltipSide = "side-start" | "side-end";

export type PortaledTooltipPlacement = "above" | PortaledTooltipSide;

const VR_STAGE_SELECTOR = '[data-testid="vr-stage"]';
const DEFAULT_HORIZONTAL_INSET = 152;

function getVrStageElement(): Element {
  return document.querySelector(VR_STAGE_SELECTOR) ?? document.documentElement;
}

export function getVrStageBounds(): DOMRect {
  const stage = document.querySelector(VR_STAGE_SELECTOR);
  if (stage) {
    return stage.getBoundingClientRect();
  }
  return document.documentElement.getBoundingClientRect();
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

    const update = () => {
      if (cancelled) return;
      const stage = getVrStageElement();
      const horizontalInset = horizontalInsetForStage(stage.getBoundingClientRect());
      tooltipEl.style.width = "";
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
        setTooltipStyle({ left: `${x}px`, top: `${y}px` });
      });
    };

    update();
    const cleanup = autoUpdate(trigger, tooltipEl, update);
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [active, triggerRef, padding, placement]);

  return { tooltipRef, placeBelow, tooltipSide, tooltipStyle };
}
