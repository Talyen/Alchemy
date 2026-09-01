import { useCallback } from "react";

export function useLabyrinthEntryGuard({
  contentSystemType,
  activeRunData,
  hasActiveBattle,
  resetMap,
  beginLabyrinth,
}: {
  contentSystemType: string;
  activeRunData: boolean;
  hasActiveBattle: boolean;
  resetMap: () => void;
  beginLabyrinth: () => void;
}) {
  return useCallback(() => {
    if ((activeRunData || hasActiveBattle) && contentSystemType !== "labyrinth") {
      resetMap();
    } else if (contentSystemType === "labyrinth" && !activeRunData && !hasActiveBattle) {
      return;
    }
    beginLabyrinth();
  }, [activeRunData, beginLabyrinth, contentSystemType, hasActiveBattle, resetMap]);
}
