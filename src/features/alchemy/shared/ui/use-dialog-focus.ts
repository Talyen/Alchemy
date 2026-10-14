import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

import { focusableControls, focusControl, focusScreenStart, isFocusAvailable } from "./focus-navigation";

// A desktop pause menu can cover a still-pending choice. Only the most recently
// mounted interactive dialog may reclaim focus; covered dialogs stay resumable.
const dialogPanels: HTMLDivElement[] = [];

export function useDialogFocus(returnFocusRef?: RefObject<HTMLElement | null>) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    dialogPanels.push(panel);
    const ownsFocus = () =>
      dialogPanels.findLast((candidate) => candidate.isConnected && !candidate.closest("[inert]")) === panel;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnTarget = returnFocusRef?.current ?? previous;
    // Controls can be disabled, removed, or replaced while a dialog stays mounted.
    const initialControl = () =>
      [...panel.querySelectorAll<HTMLElement>("[data-dialog-cancel], [data-dialog-initial-focus]")].find(
        isFocusAvailable,
      ) ??
      focusableControls(panel)[0] ??
      panel;
    let frame = 0;
    const focusPanel = () => {
      if (!ownsFocus()) return;
      if (getComputedStyle(panel).visibility === "hidden") {
        frame = requestAnimationFrame(focusPanel);
        return;
      }
      initialControl().focus();
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
      if (!ownsFocus()) return;
      if (event.target instanceof Node && !panel.contains(event.target)) initialControl().focus();
    };
    document.addEventListener("focusin", keepFocus);
    return () => {
      dialogPanels.splice(dialogPanels.indexOf(panel), 1);
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", keepFocus);
      if (focusControl(returnTarget)) return;
      // A route change may remove the opener while its screen is still inert.
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== document.body && active.isConnected && !panel?.contains(active))
          return;
        focusScreenStart();
      });
    };
  }, [returnFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = focusableControls(event.currentTarget);
    if (elements.length === 0) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }
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
