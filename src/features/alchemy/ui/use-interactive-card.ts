// Shared hover + shimmer state hook for interactive card/tile UI.
// Reads hoveredCardId from screen-store and shimmerState from battle-store,
// providing ready-to-use bindings for card buttons and tilt surfaces.
import { useBattleStore } from "../stores/battle-store";
import { useScreenStore } from "../stores/screen-store";
import { getHoverId } from "../utils";

export function useInteractiveCard(scope: string, itemId: string) {
  const hoveredCardId = useScreenStore((s) => s.hoveredCardId);
  const setHoveredCardId = useScreenStore((s) => s.setHoveredCardId);
  const shimmerState = useBattleStore((s) => s.shimmerState);
  const maybeTriggerShimmer = useBattleStore((s) => s.maybeTriggerShimmer);

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
