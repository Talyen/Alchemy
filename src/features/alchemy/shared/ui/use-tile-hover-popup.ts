import { TOOLTIP_FADE_MS } from "@/lib/game-constants";
import { useHoverVisible } from "./use-hover-visible";

export function useTileHoverPopup({
  interactive,
  isHovered,
  onHoverStart,
  onHoverEnd,
  suspended = false,
}: {
  interactive: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  suspended?: boolean;
}) {
  const { wrapperRef, showPopup, visible, handleHoverStart, handleMouseMove, handleMouseLeave, handleBlur, dismiss } =
    useHoverVisible({
      holdMs: TOOLTIP_FADE_MS,
      focusWithinGuard: true,
      interactive,
      isHovered,
      onHoverStart,
      onHoverEnd,
      suspended,
    });

  return { wrapperRef, showPopup, visible, handleHoverStart, handleMouseMove, handleMouseLeave, handleBlur, dismiss };
}
