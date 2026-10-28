import { useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../stores/react/ui-store";
import { getHoverId } from "../utils";

export function useInteractiveCard(scope: string, itemId: string, onHoverChange?: (hovered: boolean) => void) {
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

  useEffect(() => onHoverEnd, [onHoverEnd]);

  return {
    hoverId,
    isHovered,
    onHoverStart: onHoverChange
      ? () => {
          onHoverStart();
          onHoverChange(true);
        }
      : onHoverStart,
    onHoverEnd: onHoverChange
      ? () => {
          onHoverEnd();
          onHoverChange(false);
        }
      : onHoverEnd,
    shimmerActive,
    shimmerToken,
  };
}
