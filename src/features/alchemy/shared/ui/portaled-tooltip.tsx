// Root-space tooltip rendered via portal into the #tooltip-root overlay so it
// renders at constant CSS-pixel scale regardless of the vr-stage transform and
// cannot be clipped by overflow-hidden ancestors. Handles above/below flip,
// side placement, and fade-out on hide. Panels are
// pointer-events-none; visibility follows the trigger only.
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { tooltipWidthClass } from "../config";

import { getVrStageBounds, usePortaledTooltipPlacement, type PortaledTooltipSide } from "./portaled-tooltip-placement";
import { getTooltipRoot } from "./tooltip-root";
import { TooltipPanel } from "./tooltip-panel";

const DEFAULT_FADE_OUT_MS = 160;

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
  fadeOutMs = DEFAULT_FADE_OUT_MS,
}: PortaledTooltipProps) {
  const { tooltipRef, placeBelow, tooltipSide, tooltipStyle } = usePortaledTooltipPlacement(
    triggerRef,
    visible,
    padding,
    placement,
  );

  // The panel renders synchronously whenever visible (so placement measures on
  // the same commit) and stays mounted for the fade-out window after hide.
  const [mounted, setMounted] = useState(false);
  const renderPanel = visible || mounted;

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stays mounted while visible; clears any pending unmount timer
      setMounted(true);
      return;
    }
    if (!mounted) return;
    if (fadeOutMs <= 0) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), fadeOutMs);
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
      {...(tooltipSide ? { placement: tooltipSide } : {})}
      flip={placeBelow}
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
