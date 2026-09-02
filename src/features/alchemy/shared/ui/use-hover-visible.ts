import { useCallback, useEffect, useRef, useState } from "react";

export function useHoverVisible<T extends HTMLElement = HTMLDivElement>(options?: {
  holdMs?: number;
  focusWithinGuard?: boolean;
  interactive?: boolean;
  isHovered?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}) {
  const triggerRef = useRef<T>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {
    holdMs: holdMsOpt,
    focusWithinGuard: focusWithinGuardOpt,
    interactive,
    isHovered,
    onHoverStart,
    onHoverEnd,
  } = options ?? {};
  const holdMs = holdMsOpt ?? 0;
  const focusWithinGuard = focusWithinGuardOpt ?? false;
  const isControlled = isHovered !== undefined;
  const [uncontrolledVisible, setUncontrolledVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const visible = (() => {
    const raw = isControlled ? (isHovered ?? false) : uncontrolledVisible;
    if (interactive === false) return false;
    return raw;
  })();

  const doShow = useCallback(() => {
    if (interactive === false) return;
    if (isControlled) onHoverStart?.();
    else {
      setUncontrolledVisible(true);
      onHoverStart?.();
    }
  }, [interactive, isControlled, onHoverStart]);

  const doHide = useCallback(
    ({ checkFocusWithin }: { checkFocusWithin: boolean }) => {
      if (checkFocusWithin && focusWithinGuard && wrapperRef.current?.matches(":focus-within")) return;
      if (interactive === false) return;
      if (isControlled) onHoverEnd?.();
      else {
        setUncontrolledVisible(false);
        onHoverEnd?.();
      }
    },
    [focusWithinGuard, interactive, isControlled, onHoverEnd],
  );

  const show = doShow;
  const hide = useCallback(() => doHide({ checkFocusWithin: true }), [doHide]);
  const handleHoverStart = doShow;
  const handleMouseLeave = useCallback(() => doHide({ checkFocusWithin: true }), [doHide]);
  const handleBlur = useCallback(() => doHide({ checkFocusWithin: false }), [doHide]);

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
    showPopup: holdMs > 0 ? (interactive === false ? false : visible || mounted) : visible,
    onMouseEnter: isControlled ? handleHoverStart : show,
    onMouseLeave: isControlled ? handleMouseLeave : hide,
    onFocusCapture: isControlled ? handleHoverStart : show,
    onBlurCapture: isControlled ? handleBlur : hide,
    handleHoverStart,
    handleMouseLeave,
    handleBlur,
  };
}
