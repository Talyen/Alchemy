import { useHoverVisible } from "./use-hover-visible";
import { useInteractiveCard } from "./use-interactive-card";

/**
 * Shared hover + shimmer wiring for hero/difficulty chooser cards. Locked
 * cards still track hover (for their unlock tooltip) but never shimmer.
 */
export function useChooserHover(scope: string, itemId: string, locked: boolean) {
  const { shimmerActive, shimmerToken, onHoverStart, onHoverEnd } = useInteractiveCard(scope, itemId);
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } = useHoverVisible({
    ...(!locked ? { onHoverStart } : {}),
    onHoverEnd,
  });

  return {
    triggerRef,
    visible,
    onMouseEnter,
    onMouseLeave,
    onFocusCapture,
    onBlurCapture,
    shimmerActive: locked ? false : shimmerActive,
    shimmerToken: locked ? undefined : shimmerToken,
  };
}
