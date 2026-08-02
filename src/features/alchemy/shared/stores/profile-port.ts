// Canonical profile query and command port.
// Meta/profile state is part of the gameplay aggregate, but feature code should
// not depend on the compatibility profile store or its Zustand API directly.
import { useShallow } from "zustand/react/shallow";
import { dispatchRunSessionCommand } from "./run-session-command";
import { readGameplayState, useGameplayStateStore } from "./gameplay-state-store";
import type { ProfileStore } from "./profile-store";

export type ProfileReadView = Pick<
  ProfileStore,
  | "collectionTab"
  | "collectionPages"
  | "discoveredCardIds"
  | "encounteredEnemyIds"
  | "discoveredTrinketIds"
  | "completedDifficulties"
  | "finishedRunCharacters"
>;

function selectProfileWithActions(state: ReturnType<typeof readGameplayState>): ProfileStore {
  return { ...state.profile, ...state.profileActions };
}

export function readProfileStore(): ProfileReadView {
  const profile = readGameplayState().profile;
  return {
    collectionTab: profile.collectionTab,
    collectionPages: profile.collectionPages,
    discoveredCardIds: profile.discoveredCardIds,
    encounteredEnemyIds: profile.encounteredEnemyIds,
    discoveredTrinketIds: profile.discoveredTrinketIds,
    completedDifficulties: profile.completedDifficulties,
    finishedRunCharacters: profile.finishedRunCharacters,
  };
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
  dispatchRunSessionCommand(() => selectProfileWithActions(readGameplayState()).setDiscoveredCardIds(value));
}

export function setEncounteredEnemyIds(value: string[] | ((previous: string[]) => string[])): void {
  dispatchRunSessionCommand(() => selectProfileWithActions(readGameplayState()).setEncounteredEnemyIds(value));
}

export function setDiscoveredTrinketIds(value: string[] | ((previous: string[]) => string[])): void {
  dispatchRunSessionCommand(() => selectProfileWithActions(readGameplayState()).setDiscoveredTrinketIds(value));
}

export function setCompletedDifficulties(
  value:
    | ProfileStore["completedDifficulties"]
    | ((previous: ProfileStore["completedDifficulties"]) => ProfileStore["completedDifficulties"]),
): void {
  dispatchRunSessionCommand(() => selectProfileWithActions(readGameplayState()).setCompletedDifficulties(value));
}

export function setFinishedRunCharacters(value: ProfileStore["finishedRunCharacters"]): void {
  dispatchRunSessionCommand(() => selectProfileWithActions(readGameplayState()).setFinishedRunCharacters(value));
}
