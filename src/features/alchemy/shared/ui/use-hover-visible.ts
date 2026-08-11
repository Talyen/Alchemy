// Shared hover-state hook for converting CSS group-hover tooltips to
// trigger-ref + state. Tracks mouse hover plus focus-within (capture-phase
// focus/blur on a wrapper) so keyboard reachability is preserved.
import { useCallback, useRef, useState } from "react";

export function useHoverVisible<T extends HTMLElement = HTMLDivElement>() {
  const triggerRef = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  return {
    triggerRef,
    visible,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocusCapture: show,
    onBlurCapture: hide,
  };
}
