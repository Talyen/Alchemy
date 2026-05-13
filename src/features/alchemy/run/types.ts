// Persisted run-state contracts shared by controllers and save migration code.
// Depends only on game-data card and character type shapes, not React hooks.
import type { BattleCard, CharacterId } from "@/lib/game-data";

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
};
