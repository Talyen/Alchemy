import { create } from "zustand";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import { defaultSaveData, type SaveData } from "@/features/alchemy/shared/storage";

type CollectionPages = Record<CollectionTab, number>;

const initialCollectionPages: CollectionPages = { cards: 0, bestiary: 0, trinkets: 0 };

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
  initialize: (save: SaveData) => void;
}

function savedProfile(save: SaveData) {
  return {
    discoveredCardIds: [...save.discoveredCardIds],
    encounteredEnemyIds: [...save.encounteredEnemyIds],
    discoveredTrinketIds: [...save.discoveredTrinketIds],
    completedDifficulties: save.completedDifficulties,
    finishedRunCharacters: [...save.finishedRunCharacters],
  };
}

export const useProfileStore = create<ProfileStore>()((set) => ({
  collectionTab: "cards",
  collectionPages: initialCollectionPages,
  ...savedProfile(defaultSaveData),

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
      ...savedProfile(defaultSaveData),
      collectionPages: initialCollectionPages,
      collectionTab: "cards",
    }),
  initialize: (save) => set(savedProfile(save)),
}));
