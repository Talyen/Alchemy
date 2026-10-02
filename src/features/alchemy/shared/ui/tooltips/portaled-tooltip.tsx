import { useId, useLayoutEffect, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import { tooltipWidthClass } from "../../config";

import { usePortaledTooltipPlacement, type PortaledTooltipSide } from "./portaled-tooltip-placement";
import { getTooltipRoot } from "./tooltip-root";
import { TooltipPanel } from "./tooltip-panel";
import { useFadePresence, useHeldWhile } from "../use-fade";
import { usePlasmaInteraction } from "../use-plasma-source";
import { TOOLTIP_FADE_MS } from "@/lib/game-constants";

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

function TooltipContent({ visible, children }: { visible: boolean; children: ReactNode }) {
  // The snapshot lives only as long as the panel, including its exit fade.
  // Dormant triggers must not retain a previous tooltip's cards or callbacks.
  return useHeldWhile(visible, children);
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
  fadeOutMs = TOOLTIP_FADE_MS,
  plasmaColorPair = null,
}: PortaledTooltipProps) {
  const tooltipId = useId();
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!visible || !trigger) return;
    const described = new Set<HTMLElement>();
    const associate = (element: HTMLElement) => {
      described.add(element);
      const ids = new Set(element.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean));
      ids.add(tooltipId);
      element.setAttribute("aria-describedby", [...ids].join(" "));
    };
    associate(trigger);
    const focus = document.activeElement;
    if (focus instanceof HTMLElement && trigger.contains(focus)) associate(focus);
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) associate(event.target);
    };
    trigger.addEventListener("focusin", onFocus);
    return () => {
      trigger.removeEventListener("focusin", onFocus);
      for (const element of described) {
        const remaining = (element.getAttribute("aria-describedby")?.split(/\s+/) ?? []).filter(
          (id) => id !== tooltipId,
        );
        if (remaining.length > 0) element.setAttribute("aria-describedby", remaining.join(" "));
        else element.removeAttribute("aria-describedby");
      }
    };
  }, [triggerRef, tooltipId, visible]);
  usePlasmaInteraction(plasmaColorPair, visible);
  const { mounted } = useFadePresence(visible, fadeOutMs);
  const { tooltipRef, placeBelow, tooltipSide, tooltipStyle } = usePortaledTooltipPlacement(
    triggerRef,
    mounted,
    padding,
    placement,
    maxWidthFraction,
  );

  if (!mounted) return null;

  const placed = Boolean(tooltipStyle);

  return createPortal(
    <TooltipPanel
      ref={tooltipRef}
      id={tooltipId}
      width={width}
      placement={tooltipSide ?? (placeBelow ? "below" : "above")}
      visible={placed && visible}
      className={cn(
        "pointer-events-none fixed top-auto bottom-auto z-[100] mt-0 mb-0",
        !placed && "invisible opacity-0",
        className,
      )}
      style={tooltipStyle}
    >
      <TooltipContent visible={visible}>{children}</TooltipContent>
    </TooltipPanel>,
    getTooltipRoot() ?? document.body,
  );
}
