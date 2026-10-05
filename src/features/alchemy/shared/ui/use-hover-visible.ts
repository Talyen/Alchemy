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
    holdMs = 0,
    focusWithinGuard = false,
    interactive,
    suspended = false,
    isHovered,
    onHoverStart,
    onHoverEnd,
  } = options ?? {};
  const isControlled = isHovered !== undefined;
  const [uncontrolledVisible, setUncontrolledVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pointerInside = useRef(false);
  const focusInside = useRef(false);

  const visible = interactive !== false && !suspended && !dismissed && (isHovered ?? uncontrolledVisible);

  const doShow = useCallback(() => {
    if (interactive === false || suspended) return;
    if (!isControlled) setUncontrolledVisible(true);
    onHoverStart?.();
  }, [interactive, suspended, isControlled, onHoverStart]);

  const doHide = useCallback(
    (checkFocusWithin: boolean) => {
      if (
        checkFocusWithin &&
        (focusInside.current || (focusWithinGuard && wrapperRef.current?.matches(":focus-within")))
      )
        return;
      if (interactive === false) return;
      if (!isControlled) setUncontrolledVisible(false);
      onHoverEnd?.();
    },
    [focusWithinGuard, interactive, isControlled, onHoverEnd],
  );

  const handleHoverStart = useCallback(
    (event?: { type: string }) => {
      if (event?.type === "focus") focusInside.current = true;
      else pointerInside.current = true;
      if (!dismissed) doShow();
    },
    [dismissed, doShow],
  );
  const handleFocus = useCallback(() => {
    focusInside.current = true;
    if (!dismissed) doShow();
  }, [dismissed, doShow]);
  const handleMouseMove = useCallback(() => {
    pointerInside.current = true;
    if (!suspended && dismissed) {
      setDismissed(false);
      doShow();
    }
  }, [dismissed, suspended, doShow]);
  const handleMouseLeave = useCallback(() => {
    pointerInside.current = false;
    if (!suspended) setDismissed(false);
    doHide(true);
  }, [suspended, doHide]);
  const handleBlur = useCallback(
    (event?: { relatedTarget: EventTarget | null }) => {
      const next = event?.relatedTarget;
      if (next instanceof Node && (wrapperRef.current?.contains(next) || triggerRef.current?.contains(next))) return;
      focusInside.current = false;
      if (!suspended) setDismissed(false);
      if (!pointerInside.current) doHide(false);
    },
    [suspended, doHide],
  );
  const dismiss = useCallback(() => {
    setDismissed(true);
    doHide(false);
  }, [doHide]);

  if (holdMs > 0 && visible && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (holdMs <= 0 || visible || !mounted) return;
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
    onFocusCapture: handleFocus,
    onBlurCapture: handleBlur,
    handleHoverStart,
    handleMouseMove,
    handleMouseLeave,
    handleBlur,
    dismiss,
  };
}
