import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { registerDialogFocus, trapDialogTab } from "./dialog-focus-owner";

export function useDialogFocus(returnFocusRef?: RefObject<HTMLElement | null>) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return registerDialogFocus(panel, returnFocusRef?.current ?? previous);
  }, [returnFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    trapDialogTab(event.currentTarget, event);
  }

  return { panelRef, handleKeyDown };
}
