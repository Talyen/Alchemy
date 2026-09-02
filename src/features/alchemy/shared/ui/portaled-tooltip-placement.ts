import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

export interface PortaledTooltipAnchor {
  centerX: number;
  top: number;
  bottom: number;
}

export type PortaledTooltipSide = "side-start" | "side-end";

export type PortaledTooltipPlacement = "above" | PortaledTooltipSide;

const VR_STAGE_SELECTOR = '[data-testid="vr-stage"]';
const DEFAULT_HORIZONTAL_INSET = 152;

export function getVrStageBounds(): DOMRect {
  const stage = document.querySelector(VR_STAGE_SELECTOR);
  if (stage) {
    return stage.getBoundingClientRect();
  }
  return document.documentElement.getBoundingClientRect();
}

function horizontalInsetForStage(stage: Pick<DOMRect, "left" | "right">): number {
  return Math.min(DEFAULT_HORIZONTAL_INSET, Math.max(48, (stage.right - stage.left) / 4));
}

export function buildPortaledTooltipStyle(
  anchor: PortaledTooltipAnchor,
  placeBelow: boolean,
  padding = 8,
  stage: Pick<DOMRect, "left" | "right" | "top" | "bottom"> = getVrStageBounds(),
  tooltipHeight?: number,
): CSSProperties {
  const horizontalInset = horizontalInsetForStage(stage);

  if (!placeBelow && tooltipHeight != null) {
    return {
      left: `clamp(${stage.left + horizontalInset}px, ${anchor.centerX}px, ${stage.right - horizontalInset}px)`,
      top: `${anchor.top - tooltipHeight - padding}px`,
    };
  }

  return {
    left: `clamp(${stage.left + horizontalInset}px, ${anchor.centerX}px, ${stage.right - horizontalInset}px)`,
    top: placeBelow ? `${anchor.bottom + padding}px` : "auto",
    bottom: placeBelow ? "auto" : `${window.innerHeight - anchor.top + padding}px`,
  };
}

export function measurePortaledTooltipPlacement(
  anchor: PortaledTooltipAnchor,
  triggerRect: Pick<DOMRect, "left" | "right">,
  tooltipRect: Pick<DOMRect, "width" | "height">,
  stage: Pick<DOMRect, "top" | "bottom" | "left" | "right"> = getVrStageBounds(),
  padding = 8,
): { placeBelow: boolean; tooltipSide: PortaledTooltipSide | null; style: CSSProperties } {
  const spaceAbove = anchor.top - stage.top - 2 * padding;
  const spaceBelow = stage.bottom - anchor.bottom - 2 * padding;
  const fitsAbove = spaceAbove >= tooltipRect.height;
  const fitsBelow = spaceBelow >= tooltipRect.height;

  if (!fitsAbove && !fitsBelow) {
    const spaceEnd = stage.right - triggerRect.right;
    const spaceStart = triggerRect.left - stage.left;
    const preferredSide: PortaledTooltipSide = spaceEnd >= spaceStart ? "side-end" : "side-start";
    const { side, style } = buildSideTooltipStyle(anchor, triggerRect, tooltipRect, preferredSide, stage, padding);
    return { placeBelow: false, tooltipSide: side, style };
  }

  const placeBelow = !fitsAbove;
  return {
    placeBelow,
    tooltipSide: null,
    style: buildPortaledTooltipStyle(anchor, placeBelow, padding, stage, tooltipRect.height),
  };
}

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

  const halfHeight = tooltipRect.height / 2;
  const centerY = (anchor.top + anchor.bottom) / 2;
  const minTop = stage.top + halfHeight + padding;
  const maxTop = stage.bottom - halfHeight - padding;
  const top = maxTop < minTop ? (stage.top + stage.bottom) / 2 : Math.min(Math.max(centerY, minTop), maxTop);

  return { side, style: { left: `${left}px`, top: `${top}px` } };
}

const globalPlacementSubscribers = new Set<() => void>();
let globalRaf: number | null = null;
let globalListenersAttached = false;

function requestGlobalPlacementUpdate() {
  if (globalRaf !== null) return;
  globalRaf = requestAnimationFrame(() => {
    globalRaf = null;
    for (const fn of globalPlacementSubscribers) fn();
  });
}

function ensureGlobalListeners() {
  if (globalListenersAttached) return;
  globalListenersAttached = true;
  window.addEventListener("resize", requestGlobalPlacementUpdate);
  document.addEventListener("scroll", requestGlobalPlacementUpdate, true);
}

function releaseGlobalListeners() {
  if (globalPlacementSubscribers.size !== 0 || !globalListenersAttached) return;
  globalListenersAttached = false;
  window.removeEventListener("resize", requestGlobalPlacementUpdate);
  document.removeEventListener("scroll", requestGlobalPlacementUpdate, true);
  if (globalRaf !== null) {
    cancelAnimationFrame(globalRaf);
    globalRaf = null;
  }
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
  const isAdjustingRef = useRef(false);

  useLayoutEffect(() => {
    if (!active || !triggerRef.current || !tooltipRef.current) {
      if (tooltipRef.current) tooltipRef.current.style.width = "";
      setTooltipStyle(undefined);
      return;
    }

    const trigger = triggerRef.current;
    const tooltipEl = tooltipRef.current;

    const updatePlacement = () => {
      if (isAdjustingRef.current || !triggerRef.current || !tooltipRef.current) return;
      isAdjustingRef.current = true;

      const el = tooltipRef.current;
      el.style.width = "";

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = el.getBoundingClientRect();
      const stage = getVrStageBounds();
      const anchor = {
        centerX: (triggerRect.left + triggerRect.right) / 2,
        top: triggerRect.top,
        bottom: triggerRect.bottom,
      };

      if (placement === "above") {
        const measured = measurePortaledTooltipPlacement(anchor, triggerRect, tooltipRect, stage, padding);
        setTooltipSide(measured.tooltipSide);
        setPlaceBelow(measured.placeBelow);
        setTooltipStyle(measured.style);
      } else {
        const { side, style } = buildSideTooltipStyle(anchor, triggerRect, tooltipRect, placement, stage, padding);
        setTooltipSide(side);
        setPlaceBelow(false);
        setTooltipStyle(style);
      }

      isAdjustingRef.current = false;
    };

    updatePlacement();

    let frame: number | null = null;
    const requestPlacementUpdate = () => {
      if (isAdjustingRef.current || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        updatePlacement();
      });
    };

    ensureGlobalListeners();
    globalPlacementSubscribers.add(requestPlacementUpdate);

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(requestPlacementUpdate) : null;
    resizeObserver?.observe(trigger);
    resizeObserver?.observe(tooltipEl);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      globalPlacementSubscribers.delete(requestPlacementUpdate);
      releaseGlobalListeners();
      resizeObserver?.disconnect();
      tooltipEl.style.width = "";
      isAdjustingRef.current = false;
    };
  }, [active, triggerRef, padding, placement]);

  return { tooltipRef, placeBelow, tooltipSide, tooltipStyle };
}
