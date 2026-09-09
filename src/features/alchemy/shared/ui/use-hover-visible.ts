import { useCallback, useEffect, useRef, useState } from "react";

export function useHoverVisible<T extends HTMLElement = HTMLDivElement>(options?: {
  holdMs?: number;
  focusWithinGuard?: boolean;
  interactive?: boolean;
  suspended?: boolean;
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
    suspended = false,
    isHovered,
    onHoverStart,
    onHoverEnd,
  } = options ?? {};
  const holdMs = holdMsOpt ?? 0;
  const focusWithinGuard = focusWithinGuardOpt ?? false;
  const isControlled = isHovered !== undefined;
  const [uncontrolledVisible, setUncontrolledVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const visible = (() => {
    const raw = isControlled ? (isHovered ?? false) : uncontrolledVisible;
    if (interactive === false || suspended || dismissed) return false;
    return raw;
  })();

  const doShow = useCallback(() => {
    if (interactive === false || suspended) return;
    if (isControlled) onHoverStart?.();
    else {
      setUncontrolledVisible(true);
      onHoverStart?.();
    }
  }, [interactive, suspended, isControlled, onHoverStart]);

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

  const handleHoverStart = useCallback(() => {
    if (!dismissed) doShow();
  }, [dismissed, doShow]);
  const handleMouseMove = useCallback(() => {
    if (!suspended && dismissed) {
      setDismissed(false);
      doShow();
    }
  }, [dismissed, suspended, doShow]);
  const handleMouseLeave = useCallback(() => {
    if (!suspended) setDismissed(false);
    doHide({ checkFocusWithin: true });
  }, [suspended, doHide]);
  const handleBlur = useCallback(() => {
    if (!suspended) setDismissed(false);
    doHide({ checkFocusWithin: false });
  }, [suspended, doHide]);
  const dismiss = useCallback(() => {
    setDismissed(true);
    doHide({ checkFocusWithin: false });
  }, [doHide]);

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
    onMouseEnter: handleHoverStart,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    onFocusCapture: handleHoverStart,
    onBlurCapture: handleBlur,
    handleHoverStart,
    handleMouseMove,
    handleMouseLeave,
    handleBlur,
    dismiss,
  };
}
