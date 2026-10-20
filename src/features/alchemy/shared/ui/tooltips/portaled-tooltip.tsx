import { isFocusNavigationEnabled } from "../focus-input";
import { useId, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import { tooltipWidthClass } from "../../config";

import { usePortaledTooltipPlacement, type PortaledTooltipPlacement } from "./portaled-tooltip-placement";
import { useTooltipRoot } from "../portal-root";
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

  placement?: PortaledTooltipPlacement;
  allowFlip?: boolean;
  horizontalInset?: number;

  maxWidthFraction?: number;

  fadeOutMs?: number;

  plasmaColorPair?: PlasmaColorPair | null | undefined;
}

function TooltipContent({ visible, children }: { visible: boolean; children: ReactNode }) {
  // The snapshot lives only as long as the panel, including its exit fade.
  // Dormant triggers must not retain a previous tooltip's cards or callbacks.
  return useHeldWhile(visible, children);
}

function useTooltipVisible(triggerRef: RefObject<HTMLElement | null>, requested: boolean) {
  const [suppression, setSuppression] = useState({ requested, suppressed: false });
  if (suppression.requested !== requested) setSuppression({ requested, suppressed: false });
  useLayoutEffect(() => {
    if (!requested) return;
    const setSuppressed = (suppressed: boolean) =>
      setSuppression((current) =>
        current.requested === requested && current.suppressed === suppressed ? current : { requested, suppressed },
      );
    const isAvailable = () => {
      const trigger = triggerRef.current;
      return Boolean(trigger?.isConnected && !trigger.closest('[inert], [hidden], [aria-hidden="true"]'));
    };
    let pointerPressed = false;
    let pointerInside = false;
    const hasActiveFocus = () =>
      !pointerPressed &&
      isFocusNavigationEnabled() &&
      isAvailable() &&
      document.hasFocus() &&
      document.activeElement?.matches(":focus-visible") &&
      triggerRef.current?.contains(document.activeElement);
    const onPointer = (event: PointerEvent) => {
      if (event.type === "pointerdown") pointerPressed = true;
      const trigger = triggerRef.current;
      // The hand selects cards by geometry across overlapping slots and gaps.
      // Its own hover owner decides which card is active inside the hand.
      const boundary = trigger?.closest("[data-hand-slot]")?.parentElement ?? trigger;
      const inside = event.target instanceof Node && boundary?.contains(event.target);
      pointerInside = Boolean(inside);
      // Preserve keyboard inspection without reviving a panel dismissed by blur or a click.
      if (!inside && event.type === "pointermove" && hasActiveFocus()) return;
      setSuppressed(!inside || !isAvailable());
    };
    const onFocus = (event: FocusEvent) => {
      setSuppressed(
        (!isFocusNavigationEnabled() && !pointerInside) ||
          !isAvailable() ||
          !(event.target instanceof Node && triggerRef.current?.contains(event.target)),
      );
    };
    const onKeyDown = () => {
      pointerPressed = false;
    };
    const onBlur = () => {
      pointerInside = false;
      setSuppressed(true);
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null && !hasActiveFocus()) onBlur();
    };
    // Closing modals retain their children for the fade. Their tooltip portals
    // live outside the inert subtree, so they need to observe that boundary.
    const observer = new MutationObserver(() => {
      if (!isAvailable()) onBlur();
    });
    for (let element = triggerRef.current; element; element = element.parentElement) {
      observer.observe(element, { attributes: true, attributeFilter: ["inert", "hidden", "aria-hidden"] });
    }
    if (!isAvailable()) onBlur();
    // Overlays, disabled controls and window changes can interrupt React's
    // trigger-local leave/blur events. Observe actual input at the document seam.
    document.addEventListener("pointermove", onPointer, true);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onBlur);
    document.addEventListener("wheel", onBlur, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      document.removeEventListener("pointermove", onPointer, true);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("wheel", onBlur, true);
    };
  }, [triggerRef, requested]);
  return requested && !suppression.suppressed;
}

export function PortaledTooltip({
  triggerRef,
  visible: requestedVisible,
  children,
  width = tooltipWidthClass,
  className,
  padding = 8,
  placement = "above",
  allowFlip = true,
  horizontalInset,
  maxWidthFraction,
  fadeOutMs = TOOLTIP_FADE_MS,
  plasmaColorPair = null,
}: PortaledTooltipProps) {
  const visible = useTooltipVisible(triggerRef, requestedVisible);
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
  const root = useTooltipRoot();
  const { mounted } = useFadePresence(visible, fadeOutMs);
  const { tooltipRef, placeBelow, tooltipSide, tooltipStyle } = usePortaledTooltipPlacement(
    triggerRef,
    mounted,
    padding,
    placement,
    maxWidthFraction,
    allowFlip,
    horizontalInset,
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
    root ?? document.body,
  );
}
