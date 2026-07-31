import type { CharacterId, DifficultyId } from "@/lib/game-data";

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
