import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import type { PersistenceCodec } from "./persistence-codec";
import { createSliceStore } from "./slice-store-adapter";
import { createDefaultProfileSaveFields, type ProfileSaveFields } from "./profile-store-types";
import {
  applyGameplayStateUpdate,
  readGameplayState,
  subscribeGameplayCommits,
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

const profileActionKeys = new Set<string>([
  "setDiscoveredCardIds",
  "setEncounteredEnemyIds",
  "setDiscoveredTrinketIds",
  "setCompletedDifficulties",
  "setFinishedRunCharacters",
  "setCollectionPage",
  "handleCollectionTabChange",
  "resetToDefaults",
]);

function pickProfileStore(state: GameplayState): ProfileStore {
  return { ...state.profile, ...state.profileActions };
}

function writeProfileKey(state: GameplayState, key: keyof ProfileStore, value: unknown): void {
  if (profileActionKeys.has(String(key))) {
    (state.profileActions as unknown as Record<string, unknown>)[String(key)] = value;
    return;
  }
  state.profile[key as keyof ProfileStateFields] = value as never;
}

const useProfileStore = createSliceStore<ProfileStore>(pickProfileStore, PROFILE_KEYS, {}, writeProfileKey);

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
  encode: () => cloneProfileSaveFields(readGameplayState().profile),
  hydrate: (fields) =>
    applyGameplayStateUpdate((state) => {
      Object.assign(state.profile, cloneProfileSaveFields(fields));
    }),
  subscribe: (listener) => subscribeGameplayCommits(() => listener()),
};
