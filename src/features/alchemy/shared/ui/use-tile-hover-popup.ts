import { useEffect, useRef, useState } from "react";

import { TOOLTIP_FADE_OUT_MS } from "./portaled-tooltip";

export function useTileHoverPopup({
  interactive,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: {
  interactive: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [popupMounted, setPopupMounted] = useState(false);
  const showPopup = interactive && (isHovered || popupMounted);

  useEffect(() => {
    if (isHovered && interactive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- stays mounted while hovered; clears any pending unmount timer
      setPopupMounted(true);
      return;
    }
    if (!popupMounted) return;
    const timer = window.setTimeout(() => setPopupMounted(false), TOOLTIP_FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [interactive, isHovered, popupMounted]);

  function handleHoverStart() {
    if (!interactive) return;
    setPopupMounted(true);
    onHoverStart();
  }

  function handleMouseLeave() {
    if (!interactive) return;
    if (wrapperRef.current?.matches(":focus-within")) return;
    onHoverEnd();
  }

  function handleBlur() {
    if (!interactive) return;
    onHoverEnd();
  }

  return {
    wrapperRef,
    showPopup,
    handleHoverStart,
    handleMouseLeave,
    handleBlur,
  };
}
