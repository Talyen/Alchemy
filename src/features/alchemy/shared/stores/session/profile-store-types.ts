import { characters, type CharacterId, type DifficultyId } from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";

export interface ProfileSaveFields {
  hasSeenArmory: boolean;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  discoveredUniqueIds: string[];
  completedDifficulties: Record<CharacterId, DifficultyId[]>;
  finishedRunCharacters: CharacterId[];
}

function createEmptyCompletedDifficulties(): Record<CharacterId, DifficultyId[]> {
  // Derived from the character registry so new heroes are covered automatically.
  return Object.fromEntries((Object.keys(characters) as CharacterId[]).map((id) => [id, []])) as unknown as Record<
    CharacterId,
    DifficultyId[]
  >;
}

export function createDefaultProfileSaveFields(): ProfileSaveFields {
  return {
    hasSeenArmory: false,
    discoveredCardIds: [],
    encounteredEnemyIds: [],
    discoveredTrinketIds: [],
    discoveredUniqueIds: [],
    completedDifficulties: createEmptyCompletedDifficulties(),
    finishedRunCharacters: [],
  };
}

// The codec and autosave change detection must select the same profile fields.
export const PROFILE_SAVE_KEYS = Object.freeze(Object.keys(createDefaultProfileSaveFields())) as ReadonlyArray<
  keyof ProfileSaveFields
>;

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
