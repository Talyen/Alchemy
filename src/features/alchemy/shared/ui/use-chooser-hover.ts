import { useHoverVisible } from "./use-hover-visible";
import { useInteractiveCard } from "./use-interactive-card";

/**
 * Shared hover + shimmer wiring for hero/difficulty chooser cards. Locked
 * cards still track hover (for their unlock tooltip) but never shimmer.
 */
export function useChooserHover(scope: string, itemId: string, locked: boolean) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } = useHoverVisible();
  const { shimmerActive, shimmerToken, onHoverStart } = useInteractiveCard(scope, itemId);

  function handleEnter() {
    if (!locked) {
      onHoverStart();
    }
    onMouseEnter();
  }

  return {
    triggerRef,
    visible,
    onMouseEnter: handleEnter,
    onMouseLeave,
    onFocusCapture,
    onBlurCapture,
    shimmerActive: locked ? false : shimmerActive,
    shimmerToken: locked ? undefined : shimmerToken,
  };
}
