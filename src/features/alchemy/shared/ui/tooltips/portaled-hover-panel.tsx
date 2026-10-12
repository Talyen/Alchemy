import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { TOOLTIP_FADE_MS } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import { focusableControls } from "../focus-navigation";
import { useFadePresence, useHeldWhile } from "../use-fade";
import { useLatestRef } from "../use-latest-ref";
import { useCaptureEscapeCancel } from "../use-modal-escape-dismiss";
import { usePortaledTooltipPlacement } from "./portaled-tooltip-placement";
import { TooltipPanel } from "./tooltip-panel";
import { getTooltipRoot } from "./tooltip-root";

interface HoverPanelTriggerProps {
  buttonRef: RefObject<HTMLButtonElement | null>;
  ariaExpanded: boolean;
  ariaControls: string | undefined;
  ariaHasPopup: "dialog";
  onMouseEnter: () => void;
  onFocus: () => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** Interactive inspection keeps passive tooltips and their dismissal policy separate. */
export function PortaledHoverPanel({
  open,
  pinned,
  label,
  onOpen,
  onPin,
  onClose,
  trigger,
  children,
}: {
  open: boolean;
  pinned: boolean;
  label: string;
  onOpen: () => void;
  onPin: () => void;
  onClose: () => void;
  trigger: (props: HoverPanelTriggerProps) => ReactNode;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const suppressFocus = useRef(false);
  const [focusRequested, setFocusRequested] = useState(false);
  const callbacks = useLatestRef({ onOpen, onClose });
  const id = useId();
  const { mounted } = useFadePresence(open, TOOLTIP_FADE_MS);
  const { tooltipRef, tooltipStyle, tooltipSide, placeBelow } = usePortaledTooltipPlacement(triggerRef, mounted);
  const content = useHeldWhile(open, children);

  function dismiss(restoreFocus = false) {
    callbacks.current.onClose();
    if (restoreFocus) {
      suppressFocus.current = true;
      triggerRef.current?.focus({ preventScroll: true });
      suppressFocus.current = false;
    }
  }
  useCaptureEscapeCancel(open ? () => dismiss(true) : undefined);

  useLayoutEffect(() => {
    if (!open || !focusRequested || !tooltipStyle || !tooltipRef.current) return;
    (focusableControls(tooltipRef.current)[0] ?? tooltipRef.current).focus({ preventScroll: true });
    setFocusRequested(false);
  }, [open, focusRequested, tooltipStyle, tooltipRef]);

  useEffect(() => {
    if (!open) return;
    const contains = (target: EventTarget | null) =>
      target instanceof Node &&
      (triggerRef.current?.contains(target) === true || tooltipRef.current?.contains(target) === true);
    const available = () =>
      triggerRef.current?.isConnected && !triggerRef.current.closest('[inert], [hidden], [aria-hidden="true"]');
    const close = () => callbacks.current.onClose();
    const onPointer = (event: PointerEvent) => {
      if (contains(event.target)) return;
      if (event.type === "pointerdown") return close();
      if (pinned || (contains(document.activeElement) && document.activeElement?.matches(":focus-visible"))) return;
      const art = triggerRef.current?.getBoundingClientRect();
      const panel = tooltipRef.current?.getBoundingClientRect();
      if (art && panel) {
        // A narrow bridge spans the gap on either placement axis.
        const verticalBridge =
          event.clientX >= Math.max(art.left, panel.left) &&
          event.clientX <= Math.min(art.right, panel.right) &&
          event.clientY >= Math.min(art.bottom, panel.bottom) &&
          event.clientY <= Math.max(art.top, panel.top);
        const horizontalBridge =
          event.clientY >= Math.max(art.top, panel.top) &&
          event.clientY <= Math.min(art.bottom, panel.bottom) &&
          event.clientX >= Math.min(art.right, panel.right) &&
          event.clientX <= Math.max(art.left, panel.left);
        if (verticalBridge || horizontalBridge) return;
      }
      close();
    };
    const onFocus = (event: FocusEvent) => {
      if (!contains(event.target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" && event.key !== "F7") return;
      const button = triggerRef.current;
      const panel = tooltipRef.current;
      if (!button || !panel || !contains(document.activeElement)) return;
      const backward = event.shiftKey || event.key === "F7";
      const controls = focusableControls(panel);
      let next: HTMLElement | undefined;
      if (document.activeElement === button && !backward) next = controls[0] ?? panel;
      else if (panel.contains(document.activeElement)) {
        if (backward && (document.activeElement === controls[0] || document.activeElement === panel)) next = button;
        else if (!backward && (document.activeElement === controls.at(-1) || document.activeElement === panel)) {
          const outside = focusableControls(document).filter((element) => !panel.contains(element));
          next = outside[outside.indexOf(button) + 1];
        }
      }
      if (next) {
        event.preventDefault();
        event.stopPropagation();
        next.focus({ preventScroll: true });
      }
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null && !document.activeElement?.matches(":focus-visible")) close();
    };
    const observer = new MutationObserver(() => {
      if (!available()) close();
    });
    for (let element: HTMLElement | null = triggerRef.current; element; element = element.parentElement) {
      observer.observe(element, { attributes: true, attributeFilter: ["inert", "hidden", "aria-hidden"] });
    }
    if (!available()) close();
    document.addEventListener("pointermove", onPointer, true);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", close);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointermove", onPointer, true);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", close);
    };
  }, [open, pinned, callbacks, tooltipRef]);

  return (
    <>
      {trigger({
        buttonRef: triggerRef,
        ariaExpanded: open,
        ariaControls: open ? id : undefined,
        ariaHasPopup: "dialog",
        onMouseEnter: onOpen,
        onFocus: () => {
          if (!suppressFocus.current) onOpen();
        },
        onClick: (event) => {
          if (pinned) dismiss();
          else {
            onPin();
            if (event.detail === 0) setFocusRequested(true);
          }
        },
      })}
      {mounted &&
        createPortal(
          <TooltipPanel
            ref={tooltipRef}
            id={id}
            role="dialog"
            ariaLabel={label}
            ariaModal={false}
            ariaHidden={!open || !tooltipStyle}
            inert={!open || !tooltipStyle}
            tabIndex={-1}
            visible={open && Boolean(tooltipStyle)}
            placement={tooltipSide ?? (placeBelow ? "below" : "above")}
            className={cn(
              "fixed top-auto bottom-auto z-[100] mt-0 mb-0 outline-none",
              open && tooltipStyle ? "pointer-events-auto" : "pointer-events-none",
              !tooltipStyle && "invisible opacity-0",
            )}
            style={tooltipStyle}
          >
            {content}
          </TooltipPanel>,
          getTooltipRoot() ?? document.body,
        )}
    </>
  );
}
