// Root-space tooltip rendered via portal into the #tooltip-root overlay so it
// renders at constant CSS-pixel scale regardless of the vr-stage transform and
// cannot be clipped by overflow-hidden ancestors. Handles above/below flip,
// side overflow when neither vertical gutter fits, explicit side placement,
// and fade-out on hide. Panels are
// pointer-events-none; visibility follows the trigger only.
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { resolveGameDelay } from "@/lib/animation/game-timer";
import { cn } from "@/lib/utils";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import { tooltipWidthClass } from "../config";

import { getVrStageBounds, usePortaledTooltipPlacement, type PortaledTooltipSide } from "./portaled-tooltip-placement";
import { getTooltipRoot } from "./tooltip-root";
import { TooltipPanel } from "./tooltip-panel";
import { usePlasmaInteraction } from "./use-plasma-source";

export const TOOLTIP_FADE_OUT_MS = 160;

export interface PortaledTooltipProps {
  triggerRef: RefObject<HTMLElement | null>;
  visible: boolean;
  children: ReactNode;
  width?: string;
  className?: string;
  padding?: number;
  /** "above" (default) flips above/below; side-start / side-end anchor beside the trigger. */
  placement?: "above" | PortaledTooltipSide;
  /** Fraction of the vr-stage width used as a max-width safety cap on small windows. */
  maxWidthFraction?: number;
  /** Keep the panel mounted for a fade-out after hide. */
  fadeOutMs?: number;
  /** Optional ambient palette active only while this tooltip is visible. */
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
  const { tooltipRef, placeBelow, tooltipSide, tooltipStyle } = usePortaledTooltipPlacement(
    triggerRef,
    visible,
    padding,
    placement,
  );

  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount on visible transition, mirrors useFadePresence
      setMounted(true);
    }
  }, [visible]);

  const renderPanel = visible || (fadeOutMs > 0 && mounted);

  useEffect(() => {
    if (visible || !mounted || fadeOutMs <= 0) return;
    const timer = window.setTimeout(() => setMounted(false), resolveGameDelay(fadeOutMs));
    return () => window.clearTimeout(timer);
  }, [visible, mounted, fadeOutMs]);

  if (!renderPanel) return null;

  // Keep mounted for measurement, but hide until layout styles are ready to avoid a center-screen hop.
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
