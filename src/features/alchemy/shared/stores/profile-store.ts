import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import { useShallow } from "zustand/react/shallow";
import type { PersistenceCodec } from "./persistence-codec";
import { createDefaultProfileSaveFields, type ProfileSaveFields } from "./profile-store-types";
import { dispatchRunSessionCommand } from "./run-session-command";
import {
  applyGameplayStateUpdate,
  readGameplayState,
  subscribeGameplayCommits,
  useGameplayStateStore,
  type GameplayState,
  type ProfileStateFields,
} from "./gameplay-state-store";

export type { ProfileSaveFields } from "./profile-store-types";

type CollectionPages = Record<CollectionTab, number>;

export interface ProfileStore extends ProfileSaveFields {
  collectionTab: CollectionTab;
  collectionPages: CollectionPages;
  setDiscoveredCardIds: (value: string[] | ((previous: string[]) => string[])) => void;
  setEncounteredEnemyIds: (value: string[] | ((previous: string[]) => string[])) => void;
  setDiscoveredTrinketIds: (value: string[] | ((previous: string[]) => string[])) => void;
  setCompletedDifficulties: (
    value:
      | Record<CharacterId, DifficultyId[]>
      | ((previous: Record<CharacterId, DifficultyId[]>) => Record<CharacterId, DifficultyId[]>),
  ) => void;
  setFinishedRunCharacters: (value: CharacterId[] | ((previous: CharacterId[]) => CharacterId[])) => void;
  setCollectionPage: (tab: CollectionTab, page: number) => void;
  handleCollectionTabChange: (nextTab: CollectionTab) => void;
  resetToDefaults: () => void;
}

function pickProfileStore(state: GameplayState): ProfileStore {
  return { ...state.profile, ...state.profileActions };
}

interface ProfileStoreHook {
  <U = ProfileStore>(selector?: (state: ProfileStore) => U): U;
  getState: () => ProfileStore;
  getInitialState: () => ProfileStore;
  setState: (partial: Partial<ProfileStore> | ((state: ProfileStore) => Partial<ProfileStore> | void)) => void;
  subscribe: (listener: (state: ProfileStore, previousState: ProfileStore) => void) => () => void;
}

const useProfileStoreHook = ((selector?: (state: ProfileStore) => unknown) =>
  useGameplayStateStore((state) => {
    const slice = pickProfileStore(state);
    return selector ? selector(slice) : slice;
  })) as ProfileStoreHook;

useProfileStoreHook.getState = () => pickProfileStore(readGameplayState());
useProfileStoreHook.getInitialState = () => pickProfileStore(useGameplayStateStore.getInitialState());
useProfileStoreHook.setState = (partial) => {
  applyGameplayStateUpdate((state) => {
    const slice = pickProfileStore(state);
    const next = typeof partial === "function" ? partial(slice) : partial;
    if (!next || typeof next !== "object") return;
    // Only data fields — never copy action methods from getInitialState()/getState() onto the draft.
    if (next.discoveredCardIds !== undefined) state.profile.discoveredCardIds = next.discoveredCardIds;
    if (next.encounteredEnemyIds !== undefined) state.profile.encounteredEnemyIds = next.encounteredEnemyIds;
    if (next.discoveredTrinketIds !== undefined) state.profile.discoveredTrinketIds = next.discoveredTrinketIds;
    if (next.completedDifficulties !== undefined) state.profile.completedDifficulties = next.completedDifficulties;
    if (next.finishedRunCharacters !== undefined) state.profile.finishedRunCharacters = next.finishedRunCharacters;
    if (next.collectionTab !== undefined) state.profile.collectionTab = next.collectionTab;
    if (next.collectionPages !== undefined) state.profile.collectionPages = next.collectionPages;
  });
};
useProfileStoreHook.subscribe = (listener) =>
  useGameplayStateStore.subscribe((state, previousState) =>
    listener(pickProfileStore(state), pickProfileStore(previousState)),
  );

export { useProfileStoreHook as useProfileStore };

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
