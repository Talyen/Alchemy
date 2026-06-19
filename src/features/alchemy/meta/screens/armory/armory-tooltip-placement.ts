import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

export type PortaledTooltipAnchor = { centerX: number; top: number; bottom: number };

const VR_STAGE_SELECTOR = '[data-testid="vr-stage"]';
const DEFAULT_HORIZONTAL_INSET = 152;

function getVrStageBounds(): DOMRect {
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
  const placeBelow = shouldPlacePortaledTooltipBelow(anchor, tooltipRect.height, stage, padding);

  return {
    placeBelow,
    style: buildPortaledTooltipStyle(anchor, placeBelow, padding, stage),
  };
}

export function useArmoryPortaledTooltipPlacement(
  triggerRef: RefObject<HTMLElement | null>,
  active: boolean,
  padding = 8,
) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [placeBelow, setPlaceBelow] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties | undefined>(undefined);

  useLayoutEffect(() => {
    if (!active || !triggerRef.current || !tooltipRef.current) {
      setTooltipStyle(undefined);
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const stage = getVrStageBounds();

    const anchor = {
      centerX: (triggerRect.left + triggerRect.right) / 2,
      top: triggerRect.top,
      bottom: triggerRect.bottom,
    };

    const below = shouldPlacePortaledTooltipBelow(anchor, tooltipRect.height, stage, padding);
    setPlaceBelow(below);

    const style = buildPortaledTooltipStyle(anchor, below, padding, stage);
    setTooltipStyle(style);
  }, [active, triggerRef, padding]);

  return { tooltipRef, placeBelow, tooltipStyle };
}
