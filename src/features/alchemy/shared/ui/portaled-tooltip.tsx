import { type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import { tooltipWidthClass } from "../config";

import { getVrStageBounds, usePortaledTooltipPlacement, type PortaledTooltipSide } from "./portaled-tooltip-placement";
import { getTooltipRoot } from "./tooltip-root";
import { TooltipPanel } from "./tooltip-panel";
import { useFadePresence } from "./fade-presence";
import { usePlasmaInteraction } from "./use-plasma-source";
import { TOOLTIP_FADE_MS } from "@/lib/game-constants";

export const TOOLTIP_FADE_OUT_MS = TOOLTIP_FADE_MS;

export interface PortaledTooltipProps {
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  children: ReactNode;
  width?: string;
  className?: string;
  padding?: number;

  placement?: "above" | PortaledTooltipSide;

  maxWidthFraction?: number;

  fadeOutMs?: number;

  plasmaColorPair?: PlasmaColorPair | null | undefined;
}

export function PortaledTooltip({
  triggerRef,
  visible,
  children,
  width = tooltipWidthClass,
  className,
  padding = 8,
  placement = "above",
  maxWidthFraction,
  fadeOutMs = TOOLTIP_FADE_OUT_MS,
  plasmaColorPair = null,
}: PortaledTooltipProps) {
  usePlasmaInteraction(plasmaColorPair, visible);
  const { mounted } = useFadePresence(visible, fadeOutMs);
  const { tooltipRef, placeBelow, tooltipSide, tooltipStyle } = usePortaledTooltipPlacement(
    triggerRef,
    mounted,
    padding,
    placement,
  );

  if (!mounted) return null;

  const placed = Boolean(tooltipStyle);
  const maxWidth = maxWidthFraction ? `${Math.floor(getVrStageBounds().width * maxWidthFraction)}px` : undefined;

  return createPortal(
    <TooltipPanel
      ref={tooltipRef}
      width={width}
      placement={tooltipSide ?? (placeBelow ? "below" : "above")}
      visible={placed && visible}
      className={cn(
        "pointer-events-none fixed top-auto bottom-auto z-[100] mt-0 mb-0",
        !placed && "invisible opacity-0",
        className,
      )}
      style={{ ...tooltipStyle, ...(maxWidth ? { maxWidth } : {}) }}
    >
      {children}
    </TooltipPanel>,
    getTooltipRoot() ?? document.body,
  );
}
