import { create } from "zustand";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import type { PersistenceCodec } from "./persistence-codec";

type CollectionPages = Record<CollectionTab, number>;

const initialCollectionPages: CollectionPages = { cards: 0, bestiary: 0, trinkets: 0 };

export interface ProfileSaveFields {
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  completedDifficulties: Record<CharacterId, DifficultyId[]>;
  finishedRunCharacters: CharacterId[];
}

export interface ProfileStore {
  collectionTab: CollectionTab;
  collectionPages: CollectionPages;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  completedDifficulties: Record<CharacterId, DifficultyId[]>;
  finishedRunCharacters: CharacterId[];

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

export function createDefaultProfileSaveFields(): ProfileSaveFields {
  return {
    discoveredCardIds: [],
    encounteredEnemyIds: [],
    discoveredTrinketIds: [],
    completedDifficulties: {
      knight: [],
      rogue: [],
      wizard: [],
      ranger: [],
      alchemist: [],
      warlock: [],
      druid: [],
      wildcard: [],
    },
    finishedRunCharacters: [],
  };
}

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

export const useProfileStore = create<ProfileStore>()((set) => ({
  collectionTab: "cards",
  collectionPages: initialCollectionPages,
  ...createDefaultProfileSaveFields(),

  setDiscoveredCardIds: (value) =>
    set((state) => ({
      discoveredCardIds: typeof value === "function" ? value(state.discoveredCardIds) : value,
    })),
  setEncounteredEnemyIds: (value) =>
    set((state) => ({
      encounteredEnemyIds: typeof value === "function" ? value(state.encounteredEnemyIds) : value,
    })),
  setDiscoveredTrinketIds: (value) =>
    set((state) => ({
      discoveredTrinketIds: typeof value === "function" ? value(state.discoveredTrinketIds) : value,
    })),
  setCompletedDifficulties: (value) =>
    set((state) => ({
      completedDifficulties: typeof value === "function" ? value(state.completedDifficulties) : value,
    })),
  setFinishedRunCharacters: (value) =>
    set((state) => ({
      finishedRunCharacters: typeof value === "function" ? value(state.finishedRunCharacters) : value,
    })),
  setCollectionPage: (tab, page) =>
    set((state) => ({
      collectionPages: { ...state.collectionPages, [tab]: Math.max(0, page) },
    })),
  handleCollectionTabChange: (collectionTab) =>
    set((state) => ({
      collectionTab,
      collectionPages: {
        ...state.collectionPages,
        [collectionTab]: state.collectionPages[collectionTab] ?? 0,
      },
    })),
  resetToDefaults: () =>
    set({
      ...createDefaultProfileSaveFields(),
      collectionPages: initialCollectionPages,
      collectionTab: "cards",
    }),
}));

export const profilePersistenceCodec: PersistenceCodec<ProfileSaveFields> = {
  createDefault: createDefaultProfileSaveFields,
  encode: () => cloneProfileSaveFields(useProfileStore.getState()),
  hydrate: (fields) => {
    useProfileStore.setState(cloneProfileSaveFields(fields));
  },
  subscribe: (listener) => useProfileStore.subscribe(listener),
};
