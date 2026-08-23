import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";

export interface ProfileSaveFields {
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  completedDifficulties: Record<CharacterId, DifficultyId[]>;
  finishedRunCharacters: CharacterId[];
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

/** Persisted profile fields plus collection UI state. */
export interface ProfileStateFields extends ProfileSaveFields {
  collectionTab: CollectionTab;
  collectionPages: Record<CollectionTab, number>;
}

export function createInitialProfileState(): ProfileStateFields {
  return {
    ...createDefaultProfileSaveFields(),
    collectionTab: "cards",
    collectionPages: { cards: 0, bestiary: 0, trinkets: 0 },
  };
}
