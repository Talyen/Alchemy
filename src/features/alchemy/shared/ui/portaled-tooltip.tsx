// Stage-aware tooltip rendered via portal so overflow-hidden ancestors cannot clip it.
// Used by armory gear/currency tooltips and battle/collection enemy tooltips.
import { createPortal } from "react-dom";
import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

import { usePortaledTooltipPlacement } from "./portaled-tooltip-placement";
import { TooltipPanel } from "./tooltip-panel";

interface PortaledTooltipProps {
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  children: ReactNode;
  width?: string;
  className?: string;
  padding?: number;
}

export function PortaledTooltip({
  triggerRef,
  visible,
  children,
  width = "w-72",
  className,
  padding = 8,
}: PortaledTooltipProps) {
  const { tooltipRef, placeBelow, tooltipStyle } = usePortaledTooltipPlacement(triggerRef, visible, padding);

  if (!visible) return null;

  // Keep mounted for measurement, but hide until layout styles are ready to avoid a center-screen hop.
  const placed = Boolean(tooltipStyle);

  return createPortal(
    <TooltipPanel
      ref={tooltipRef}
      width={width}
      visible={placed}
      flip={placeBelow}
      className={cn(
        "pointer-events-none fixed top-auto bottom-auto z-[100] mt-0 mb-0",
        !placed && "invisible opacity-0",
        className,
      )}
      style={tooltipStyle}
    >
      {children}
    </TooltipPanel>,
    document.body,
  );
}
