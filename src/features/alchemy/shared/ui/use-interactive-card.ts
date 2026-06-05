// Shared hover + shimmer state hook for interactive card/tile UI.
// Reads hoveredCardId and shimmerState from screen-store,
// providing ready-to-use bindings for card buttons and tilt surfaces.
import { useUiStore } from "../stores/ui-store";
import { getHoverId } from "../utils";

export function useInteractiveCard(scope: string, itemId: string) {
  const hoveredCardId = useUiStore((s) => s.hoveredCardId);
  const setHoveredCardId = useUiStore((s) => s.setHoveredCardId);
  const shimmerState = useUiStore((s) => s.shimmerState);
  const maybeTriggerShimmer = useUiStore((s) => s.maybeTriggerShimmer);

  const hoverId = getHoverId(scope, itemId);
  const isHovered = hoveredCardId === hoverId;

  return {
    hoverId,
    isHovered,
    onHoverStart: () => {
      setHoveredCardId(hoverId);
      maybeTriggerShimmer(hoverId);
    },
    onHoverEnd: () => setHoveredCardId((current) => (current === hoverId ? null : current)),
    shimmerActive: shimmerState?.cardId === hoverId,
    shimmerToken: shimmerState?.token,
  };
}
