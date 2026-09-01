import { useCallback, useEffect, useRef, useState } from "react";

export function useHoverVisible<T extends HTMLElement = HTMLDivElement>(options?: {
  holdMs?: number;
  focusWithinGuard?: boolean;
}) {
  const triggerRef = useRef<T>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const holdMs = options?.holdMs ?? 0;
  const focusWithinGuard = options?.focusWithinGuard ?? false;

  const show = useCallback(() => {
    setVisible(true);
  }, []);
  const hide = useCallback(() => {
    if (focusWithinGuard && wrapperRef.current?.matches(":focus-within")) return;
    setVisible(false);
  }, [focusWithinGuard]);

  useEffect(() => {
    if (holdMs <= 0) return;
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hold mounts hover popup through fade-out
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const timer = window.setTimeout(() => setMounted(false), holdMs);
    return () => window.clearTimeout(timer);
  }, [visible, mounted, holdMs]);

  return {
    triggerRef,
    wrapperRef,
    visible,
    mounted: holdMs > 0 ? mounted : visible,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocusCapture: show,
    onBlurCapture: hide,
  };
}
