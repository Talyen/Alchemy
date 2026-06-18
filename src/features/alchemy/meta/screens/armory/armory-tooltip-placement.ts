import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export type PortaledTooltipAnchor = { centerX: number; top: number; bottom: number };

const VR_STAGE_SELECTOR = '[data-testid="vr-stage"]';
const DEFAULT_HORIZONTAL_INSET = 152;

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
  const spaceAbove = anchor.top - stage.top - padding;
  if (spaceAbove >= tooltipHeight) {
    return false;
  }

  const spaceBelow = stage.bottom - anchor.bottom - padding;
  return spaceBelow >= tooltipHeight || spaceBelow > spaceAbove;
}

export function buildPortaledTooltipStyle(
  anchor: PortaledTooltipAnchor,
  placeBelow: boolean,
  padding = 8,
  stage: Pick<DOMRect, "left" | "right"> = getVrStageBounds(),
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
  let placeBelow = shouldPlacePortaledTooltipBelow(anchor, tooltipRect.height, stage, padding);

  if (!placeBelow && tooltipRect.top < stage.top + padding) {
    placeBelow = true;
  }

  if (placeBelow && tooltipRect.bottom > stage.bottom - padding) {
    const spaceAbove = anchor.top - stage.top - padding;
    const spaceBelow = stage.bottom - anchor.bottom - padding;
    if (spaceAbove > spaceBelow) {
      placeBelow = false;
    }
  }

  return {
    placeBelow,
    style: buildPortaledTooltipStyle(anchor, placeBelow, padding, stage),
  };
}

export function useArmoryPortaledTooltipPlacement(anchor: PortaledTooltipAnchor | null, active: boolean, padding = 8) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [placeBelow, setPlaceBelow] = useState(false);
  const [prevActive, setPrevActive] = useState(active);
  const [prevAnchor, setPrevAnchor] = useState(anchor);

  if (active !== prevActive || anchor !== prevAnchor) {
    setPrevActive(active);
    setPrevAnchor(anchor);
    setPlaceBelow(false);
  }

  useLayoutEffect(() => {
    if (!active || !anchor || !tooltipRef.current) return;

    const stage = getVrStageBounds();
    const rect = tooltipRef.current.getBoundingClientRect();
    const nextPlacement = measurePortaledTooltipPlacement(anchor, rect, stage, padding);

    if (nextPlacement.placeBelow !== placeBelow) {
      setPlaceBelow(nextPlacement.placeBelow);
    }
  }, [active, anchor, placeBelow, padding]);

  const tooltipStyle = anchor ? buildPortaledTooltipStyle(anchor, placeBelow, padding) : undefined;

  return { tooltipRef, placeBelow, tooltipStyle };
}
