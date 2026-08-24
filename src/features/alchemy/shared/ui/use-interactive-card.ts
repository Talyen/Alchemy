// Shared hover + shimmer state hook for interactive card/tile UI.
// Reads hoveredCardId and shimmerState from ui-store,
// providing ready-to-use bindings for card buttons and shared art surfaces.
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../stores/ui-store";
import { getHoverId } from "../utils";

export function useInteractiveCard(scope: string, itemId: string) {
  const hoverId = getHoverId(scope, itemId);
  const setHoveredCardId = useUiStore((s) => s.setHoveredCardId);
  const maybeTriggerShimmer = useUiStore((s) => s.maybeTriggerShimmer);
  const { isHovered, shimmerActive, shimmerToken } = useUiStore(
    useShallow((s) => ({
      isHovered: s.hoveredCardId === hoverId,
      shimmerActive: s.shimmerState?.cardId === hoverId,
      shimmerToken: s.shimmerState?.cardId === hoverId ? s.shimmerState.token : undefined,
    })),
  );

  const onHoverStart = useCallback(() => {
    setHoveredCardId(hoverId);
    maybeTriggerShimmer(hoverId);
  }, [hoverId, maybeTriggerShimmer, setHoveredCardId]);

  const onHoverEnd = useCallback(() => {
    setHoveredCardId((current) => (current === hoverId ? null : current));
  }, [hoverId, setHoveredCardId]);

  return {
    hoverId,
    isHovered,
    onHoverStart,
    onHoverEnd,
    shimmerActive,
    shimmerToken,
  };
}
