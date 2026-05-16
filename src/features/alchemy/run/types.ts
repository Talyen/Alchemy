// Persisted run-state contracts shared by controllers and save migration code.
// Depends only on game-data card and character type shapes, not React hooks.
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";

import type { ContentSystemId } from "@/lib/content-systems/types";
import type { LabyrinthMap } from "@/lib/content-systems/types";

export type ActiveRunData = {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: string[];
  runTrinkets: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap | null;
};
