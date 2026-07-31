import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import type { PersistenceCodec } from "./persistence-codec";
import { createSliceStore } from "./slice-store-adapter";
import { createDefaultProfileSaveFields, type ProfileSaveFields } from "./profile-store-types";

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

const PROFILE_KEYS = [
  "collectionTab",
  "collectionPages",
  "discoveredCardIds",
  "encounteredEnemyIds",
  "discoveredTrinketIds",
  "completedDifficulties",
  "finishedRunCharacters",
  "setDiscoveredCardIds",
  "setEncounteredEnemyIds",
  "setDiscoveredTrinketIds",
  "setCompletedDifficulties",
  "setFinishedRunCharacters",
  "setCollectionPage",
  "handleCollectionTabChange",
  "resetToDefaults",
] as const satisfies ReadonlyArray<keyof ProfileStore>;

const useProfileStore = createSliceStore<ProfileStore>((state) => {
  const profile = state as unknown as ProfileStore;
  return profile;
}, PROFILE_KEYS);

export { useProfileStore };

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
  encode: () => cloneProfileSaveFields(useProfileStore.getState()),
  hydrate: (fields) => useProfileStore.setState(cloneProfileSaveFields(fields)),
  subscribe: (listener) => useProfileStore.subscribe(() => listener()),
};
