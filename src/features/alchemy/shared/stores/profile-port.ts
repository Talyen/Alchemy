// Canonical profile query and command port.
// Meta/profile state is part of the gameplay aggregate, but feature code should
// not depend on the compatibility profile store or its Zustand API directly.
import { useShallow } from "zustand/react/shallow";
import { dispatchRunSessionCommand } from "./run-session-command";
import { readGameplayState, useGameplayStateStore } from "./gameplay-state-store";
import type { ProfileStore } from "./profile-store";

function selectProfile(state: ReturnType<typeof readGameplayState>): ProfileStore {
  return { ...state.profile, ...state.profileActions };
}

export function readProfileStore(): ProfileStore {
  return selectProfile(readGameplayState());
}

export function useProfileDiscoverySlice() {
  return useGameplayStateStore(
    useShallow((state) => ({
      discoveredCardIds: state.profile.discoveredCardIds,
      encounteredEnemyIds: state.profile.encounteredEnemyIds,
      discoveredTrinketIds: state.profile.discoveredTrinketIds,
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
      collectionPages: state.profile.collectionPages,
    })),
  );
}

export function useFinishedRunCharacters() {
  return useGameplayStateStore((state) => state.profile.finishedRunCharacters);
}

export function useCompletedDifficulties() {
  return useGameplayStateStore((state) => state.profile.completedDifficulties);
}

export function setDiscoveredCardIds(value: string[] | ((previous: string[]) => string[])): void {
  dispatchRunSessionCommand(() => readProfileStore().setDiscoveredCardIds(value));
}

export function setEncounteredEnemyIds(value: string[] | ((previous: string[]) => string[])): void {
  dispatchRunSessionCommand(() => readProfileStore().setEncounteredEnemyIds(value));
}

export function setDiscoveredTrinketIds(value: string[] | ((previous: string[]) => string[])): void {
  dispatchRunSessionCommand(() => readProfileStore().setDiscoveredTrinketIds(value));
}

export function setCompletedDifficulties(
  value:
    | ProfileStore["completedDifficulties"]
    | ((previous: ProfileStore["completedDifficulties"]) => ProfileStore["completedDifficulties"]),
): void {
  dispatchRunSessionCommand(() => readProfileStore().setCompletedDifficulties(value));
}

export function setFinishedRunCharacters(value: ProfileStore["finishedRunCharacters"]): void {
  dispatchRunSessionCommand(() => readProfileStore().setFinishedRunCharacters(value));
}
