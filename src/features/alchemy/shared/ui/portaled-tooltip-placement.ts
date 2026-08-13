import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

export interface PortaledTooltipAnchor {
  centerX: number;
  top: number;
  bottom: number;
}

export type PortaledTooltipSide = "side-start" | "side-end";

/** "above" flips above/below the trigger; side placements anchor beside it. */
export type PortaledTooltipPlacement = "above" | PortaledTooltipSide;

const VR_STAGE_SELECTOR = '[data-testid="vr-stage"]';
const DEFAULT_HORIZONTAL_INSET = 152;

/** Clip bounds for tooltips: the VR stage when present, otherwise the document. */
export function getVrStageBounds(): DOMRect {
  const stage = document.querySelector(VR_STAGE_SELECTOR);
  if (stage) {
    return stage.getBoundingClientRect();
  }
  return document.documentElement.getBoundingClientRect();
}

/** Prefer above unless the tooltip would clip the vr-stage top edge. */
export function shouldPlacePortaledTooltipBelow(
  anchor: PortaledTooltipAnchor,
  tooltipHeight: number,
  stage: Pick<DOMRect, "top" | "bottom">,
  padding = 8,
): boolean {
  const spaceAbove = anchor.top - stage.top - 2 * padding;
  if (spaceAbove >= tooltipHeight) {
    return false;
  }

  const spaceBelow = stage.bottom - anchor.bottom - 2 * padding;
  return spaceBelow >= tooltipHeight || spaceBelow > spaceAbove;
}

export function buildPortaledTooltipStyle(
  anchor: PortaledTooltipAnchor,
  placeBelow: boolean,
  padding = 8,
  stage: Pick<DOMRect, "left" | "right" | "top" | "bottom"> = getVrStageBounds(),
): CSSProperties {
  const horizontalInset = Math.min(DEFAULT_HORIZONTAL_INSET, Math.max(48, (stage.right - stage.left) / 4));

  return {
    left: `clamp(${stage.left + horizontalInset}px, ${anchor.centerX}px, ${stage.right - horizontalInset}px)`,
    top: placeBelow ? `${anchor.bottom + padding}px` : "auto",
    bottom: placeBelow ? "auto" : `${window.innerHeight - anchor.top + padding}px`,
  };
}

export function measurePortaledTooltipPlacement(
  anchor: PortaledTooltipAnchor,
  tooltipRect: Pick<DOMRect, "top" | "bottom" | "height">,
  stage: Pick<DOMRect, "top" | "bottom" | "left" | "right"> = getVrStageBounds(),
  padding = 8,
): { placeBelow: boolean; style: CSSProperties } {
  const placeBelow = shouldPlacePortaledTooltipBelow(anchor, tooltipRect.height, stage, padding);

  return {
    placeBelow,
    style: buildPortaledTooltipStyle(anchor, placeBelow, padding, stage),
  };
}

/** Position a tooltip beside the trigger, flipping to the other side when clipped. */
export function buildSideTooltipStyle(
  anchor: PortaledTooltipAnchor,
  triggerRect: Pick<DOMRect, "left" | "right">,
  tooltipRect: Pick<DOMRect, "width" | "height">,
  preferredSide: PortaledTooltipSide,
  stage: Pick<DOMRect, "left" | "right" | "top" | "bottom"> = getVrStageBounds(),
  padding = 8,
): { side: PortaledTooltipSide; style: CSSProperties } {
  let side = preferredSide;
  let left = side === "side-end" ? triggerRect.right + padding : triggerRect.left - padding - tooltipRect.width;

  if (side === "side-end" && left + tooltipRect.width + padding > stage.right) {
    side = "side-start";
    left = triggerRect.left - padding - tooltipRect.width;
  } else if (side === "side-start" && left < stage.left + padding) {
    side = "side-end";
    left = triggerRect.right + padding;
  }

  left = Math.max(stage.left + padding, Math.min(left, stage.right - padding - tooltipRect.width));

  // Vertically center on the trigger, clamped inside the stage. The panel is
  // translateY(-50%)-centered via CSS, so `top` is the center line.
  const halfHeight = tooltipRect.height / 2;
  const centerY = (anchor.top + anchor.bottom) / 2;
  const minTop = stage.top + halfHeight + padding;
  const maxTop = stage.bottom - halfHeight - padding;
  const top = Math.min(Math.max(centerY, minTop), Math.max(minTop, maxTop));

  return { side, style: { left: `${left}px`, top: `${top}px` } };
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
    if (!active || !triggerRef.current || !tooltipRef.current) {
      setTooltipStyle(undefined);
      return;
    }

    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;

    const updatePlacement = () => {
      if (!triggerRef.current || !tooltipRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const stage = getVrStageBounds();
      const anchor = {
        centerX: (triggerRect.left + triggerRect.right) / 2,
        top: triggerRect.top,
        bottom: triggerRect.bottom,
      };

      if (placement === "above") {
        const measured = measurePortaledTooltipPlacement(anchor, tooltipRect, stage, padding);
        setTooltipSide(null);
        setPlaceBelow(measured.placeBelow);
        setTooltipStyle(measured.style);
      } else {
        const { side, style } = buildSideTooltipStyle(anchor, triggerRect, tooltipRect, placement, stage, padding);
        setTooltipSide(side);
        setPlaceBelow(false);
        setTooltipStyle(style);
      }
    };

    updatePlacement();

    const onScrollOrResize = () => updatePlacement();
    window.addEventListener("resize", onScrollOrResize);
    // Capture scroll from nested overflow containers (armory inventory, collection grids).
    document.addEventListener("scroll", onScrollOrResize, true);

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updatePlacement()) : null;
    resizeObserver?.observe(trigger);
    resizeObserver?.observe(tooltip);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      document.removeEventListener("scroll", onScrollOrResize, true);
      resizeObserver?.disconnect();
    };
  }, [active, triggerRef, padding, placement]);

  return { tooltipRef, placeBelow, tooltipSide, tooltipStyle };
}
