import { useShallow } from "zustand/react/shallow";
import { useGameplayStateStore } from "./gameplay-state-store";
import type { ProfileStateFields } from "./profile-store-types";

export function useProfileSlice<T>(selector: (profile: ProfileStateFields) => T): T {
  return useGameplayStateStore(useShallow((state) => selector(state.profile)));
}

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
