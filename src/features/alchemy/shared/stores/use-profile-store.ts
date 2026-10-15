import { useShallow } from "zustand/react/shallow";
import { useGameplayStateStore } from "./gameplay-state-store";

export function useProfileDiscoverySlice() {
  return useGameplayStateStore(
    useShallow((state) => ({
      discoveredCardIds: state.profile.discoveredCardIds,
      encounteredEnemyIds: state.profile.encounteredEnemyIds,
      discoveredTrinketIds: state.profile.discoveredTrinketIds,
      discoveredUniqueIds: state.profile.discoveredUniqueIds,
    })),
  );
}

export function useProfileCollectionSlice() {
  return useGameplayStateStore(
    useShallow((state) => ({
      collectionTab: state.profile.collectionTab,
      discoveredCardIds: state.profile.discoveredCardIds,
      encounteredEnemyIds: state.profile.encounteredEnemyIds,
      discoveredTrinketIds: state.profile.discoveredTrinketIds,
      discoveredUniqueIds: state.profile.discoveredUniqueIds,
      collectionPages: state.profile.collectionPages,
    })),
  );
}

export function useFinishedRunCharacters() {
  return useGameplayStateStore(useShallow((state) => state.profile.finishedRunCharacters));
}

export function useCompletedDifficulties() {
  return useGameplayStateStore(useShallow((state) => state.profile.completedDifficulties));
}

export function useActiveBoardId() {
  return useGameplayStateStore((state) => state.profile.activeBoardId);
}

export function useBoards() {
  return useGameplayStateStore(
    useShallow((state) => ({
      collectedBoardIds: state.profile.collectedBoardIds,
      boardSelection: state.profile.boardSelection,
      activeBoardId: state.profile.activeBoardId,
      pendingBoardRewardId: state.profile.pendingBoardRewardId,
    })),
  );
}
