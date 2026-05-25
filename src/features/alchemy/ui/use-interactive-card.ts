// Shared hover + shimmer state hook for interactive card/tile UI.
// Reads hoveredCardId and shimmerState from screen-store,
// providing ready-to-use bindings for card buttons and tilt surfaces.
import { useScreenStore } from "../stores/screen-store";
import { getHoverId } from "../utils";

export function useInteractiveCard(scope: string, itemId: string) {
  const hoveredCardId = useScreenStore((s) => s.hoveredCardId);
  const setHoveredCardId = useScreenStore((s) => s.setHoveredCardId);
  const shimmerState = useScreenStore((s) => s.shimmerState);
  const maybeTriggerShimmer = useScreenStore((s) => s.maybeTriggerShimmer);

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
