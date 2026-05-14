// Pure helpers for converting live run state into persisted active-run snapshots.
// Depends only on run save contracts and game-data card/character type shapes.
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";

import type { ActiveRunData } from "./types";

type ActiveRunSource = {
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
};

// Save snapshots intentionally copy only persisted run fields so transient UI/combat state stays out of storage.
export function createActiveRunData(source: ActiveRunSource): ActiveRunData {
  return {
    characterId: source.characterId,
    runDeck: source.runDeck,
    runGold: source.runGold,
    runPlayerHealth: source.runPlayerHealth,
    runMaxHealth: source.runMaxHealth,
    roomsEncountered: source.roomsEncountered,
    currentAct: source.currentAct,
    destinationIndexInAct: source.destinationIndexInAct,
    completedDestinations: source.completedDestinations,
    runTrinkets: source.runTrinkets,
    selectedDifficulty: source.selectedDifficulty,
  };
}
