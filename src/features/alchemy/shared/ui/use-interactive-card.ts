// Shared hover + shimmer state hook for interactive card/tile UI.
// Reads hoveredCardId and shimmerState from ui-store,
// providing ready-to-use bindings for card buttons and tilt surfaces.
import { useCallback } from "react";
import { useUiStore } from "../stores/ui-store";
import { getHoverId } from "../utils";

export function useInteractiveCard(scope: string, itemId: string) {
  const hoveredCardId = useUiStore((s) => s.hoveredCardId);
  const setHoveredCardId = useUiStore((s) => s.setHoveredCardId);
  const shimmerState = useUiStore((s) => s.shimmerState);
  const maybeTriggerShimmer = useUiStore((s) => s.maybeTriggerShimmer);

  const hoverId = getHoverId(scope, itemId);
  const isHovered = hoveredCardId === hoverId;

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
    shimmerActive: shimmerState?.cardId === hoverId,
    shimmerToken: shimmerState?.token,
  };
}
