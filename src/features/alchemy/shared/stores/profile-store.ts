import type { CharacterId, DifficultyId } from "@/lib/game-data";
import { useShallow } from "zustand/react/shallow";
import type { PersistenceCodec } from "./persistence-codec";
import { createDefaultProfileSaveFields, type ProfileSaveFields } from "./profile-store-types";
import { bindWriteAction } from "./run-session-command";
import {
  applyGameplayStateUpdate,
  readGameplayState,
  subscribeGameplayCommits,
  useGameplayStateStore,
  type GameplayState,
  type ProfileStateFields,
} from "./gameplay-state-store";

export type { ProfileSaveFields } from "./profile-store-types";

function cloneProfileSaveFields(fields: ProfileSaveFields): ProfileSaveFields {
  return {
    discoveredCardIds: [...fields.discoveredCardIds],
    encounteredEnemyIds: [...fields.encounteredEnemyIds],
    discoveredTrinketIds: [...fields.discoveredTrinketIds],
    completedDifficulties: Object.fromEntries(
      Object.entries(fields.completedDifficulties).map(([characterId, difficulties]) => [
        characterId,
        [...difficulties],
      ]),
    ) as Record<CharacterId, DifficultyId[]>,
    finishedRunCharacters: [...fields.finishedRunCharacters],
  };
}

export const profilePersistenceCodec: PersistenceCodec<ProfileSaveFields> = {
  createDefault: createDefaultProfileSaveFields,
  encode: () => cloneProfileSaveFields(readGameplayState().profile),
  hydrate: (fields) =>
    applyGameplayStateUpdate((state) => {
      Object.assign(state.profile, cloneProfileSaveFields(fields));
    }),
  subscribe: (listener) => subscribeGameplayCommits(() => listener()),
};

/** Feature-facing read view — data only, no Zustand hook surface. */
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

const profileActions = (state: GameplayState) => state.profileActions;

export const setDiscoveredCardIds = bindWriteAction((s) => profileActions(s).setDiscoveredCardIds);
export const setEncounteredEnemyIds = bindWriteAction((s) => profileActions(s).setEncounteredEnemyIds);
export const setDiscoveredTrinketIds = bindWriteAction((s) => profileActions(s).setDiscoveredTrinketIds);
export const setCompletedDifficulties = bindWriteAction((s) => profileActions(s).setCompletedDifficulties);
export const setFinishedRunCharacters = bindWriteAction((s) => profileActions(s).setFinishedRunCharacters);
