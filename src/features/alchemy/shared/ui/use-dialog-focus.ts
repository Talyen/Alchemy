import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

export function useDialogFocus(returnFocusRef?: RefObject<HTMLElement | null>) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnTarget = returnFocusRef?.current ?? previous;
    const cancel = panel?.querySelector<HTMLElement>("[data-dialog-cancel], [data-dialog-initial-focus]");
    let frame = 0;
    const focusPanel = () => {
      if (!panel?.isConnected || panel.closest("[inert]")) return;
      if (getComputedStyle(cancel ?? panel).visibility === "hidden") {
        frame = requestAnimationFrame(focusPanel);
        return;
      }
      (cancel ?? panel).focus();
    };
    // Portaled panels mount invisibly to measure and decode their artwork.
    const content = panel?.closest("[data-modal-content]");
    frame = requestAnimationFrame(focusPanel);
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      // Let inherited visibility settle before focusing the actual control.
      frame = requestAnimationFrame(focusPanel);
    });
    if (content) observer.observe(content, { attributes: true, attributeFilter: ["inert"] });
    const keepFocus = (event: FocusEvent) => {
      if (panel?.closest("[inert]")) return;
      if (event.target instanceof Node && !panel?.contains(event.target)) (cancel ?? panel)?.focus();
    };
    document.addEventListener("focusin", keepFocus);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", keepFocus);
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [returnFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return { panelRef, handleKeyDown };
}
