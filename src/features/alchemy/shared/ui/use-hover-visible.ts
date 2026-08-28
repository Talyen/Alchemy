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
