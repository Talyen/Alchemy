import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";

export interface ProfileSaveFields {
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  discoveredUniqueIds: string[];
  completedDifficulties: Record<CharacterId, DifficultyId[]>;
  finishedRunCharacters: CharacterId[];
}

export function createDefaultProfileSaveFields(): ProfileSaveFields {
  return {
    discoveredCardIds: [],
    encounteredEnemyIds: [],
    discoveredTrinketIds: [],
    discoveredUniqueIds: [],
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

export interface ProfileStateFields extends ProfileSaveFields {
  collectionTab: CollectionTab;
  collectionPages: Record<CollectionTab, number>;
}

export function createInitialProfileState(): ProfileStateFields {
  return {
    ...createDefaultProfileSaveFields(),
    collectionTab: "heroes",
    collectionPages: { heroes: 0, cards: 0, bestiary: 0, trinkets: 0, uniques: 0 },
  };
}
