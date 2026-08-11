// Shared hover + shimmer state hook for interactive card/tile UI.
// Reads hoveredCardId and shimmerState from ui-store,
// providing ready-to-use bindings for card buttons and tilt surfaces.
import { useCallback } from "react";
import { useUiStore } from "../stores/ui-store";
import { getHoverId } from "../utils";

export function useInteractiveCard(scope: string, itemId: string) {
  const hoverId = getHoverId(scope, itemId);
  const isHovered = useUiStore((s) => s.hoveredCardId === hoverId);
  const setHoveredCardId = useUiStore((s) => s.setHoveredCardId);
  const shimmerActive = useUiStore((s) => s.shimmerState?.cardId === hoverId);
  const shimmerToken = useUiStore((s) => (s.shimmerState?.cardId === hoverId ? s.shimmerState.token : undefined));
  const maybeTriggerShimmer = useUiStore((s) => s.maybeTriggerShimmer);

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
