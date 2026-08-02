// Canonical profile query and command port.
// Meta/profile state is part of the gameplay aggregate, but feature code should
// not depend on the profile store's Zustand API directly.
import { useShallow } from "zustand/react/shallow";
import { dispatchRunSessionCommand } from "./run-session-command";
import { readGameplayState, useGameplayStateStore, type ProfileStateFields } from "./gameplay-state-store";

export type ProfileReadView = Pick<
  ProfileStateFields,
  | "collectionTab"
  | "collectionPages"
  | "discoveredCardIds"
  | "encounteredEnemyIds"
  | "discoveredTrinketIds"
  | "completedDifficulties"
  | "finishedRunCharacters"
>;

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
  dispatchRunSessionCommand(() => readGameplayState().profileActions.setDiscoveredCardIds(value));
}

export function setEncounteredEnemyIds(value: string[] | ((previous: string[]) => string[])): void {
  dispatchRunSessionCommand(() => readGameplayState().profileActions.setEncounteredEnemyIds(value));
}

export function setDiscoveredTrinketIds(value: string[] | ((previous: string[]) => string[])): void {
  dispatchRunSessionCommand(() => readGameplayState().profileActions.setDiscoveredTrinketIds(value));
}

export function setCompletedDifficulties(
  value:
    | ProfileStateFields["completedDifficulties"]
    | ((previous: ProfileStateFields["completedDifficulties"]) => ProfileStateFields["completedDifficulties"]),
): void {
  dispatchRunSessionCommand(() => readGameplayState().profileActions.setCompletedDifficulties(value));
}

export function setFinishedRunCharacters(value: ProfileStateFields["finishedRunCharacters"]): void {
  dispatchRunSessionCommand(() => readGameplayState().profileActions.setFinishedRunCharacters(value));
}
