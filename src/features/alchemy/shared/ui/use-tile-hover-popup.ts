import { TOOLTIP_FADE_OUT_MS } from "./portaled-tooltip";
import { useHoverVisible } from "./use-hover-visible";

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
  const { wrapperRef, showPopup, handleHoverStart, handleMouseLeave, handleBlur } = useHoverVisible<HTMLDivElement>({
    holdMs: TOOLTIP_FADE_OUT_MS,
    focusWithinGuard: true,
    interactive,
    isHovered,
    onHoverStart,
    onHoverEnd,
  });

  return { wrapperRef, showPopup, handleHoverStart, handleMouseLeave, handleBlur };
}
