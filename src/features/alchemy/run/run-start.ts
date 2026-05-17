// Pure run-start snapshot builder for campaign, labyrinth, and wildwood entry points.
// Depends on character starter decks and HP constants; React controllers apply the snapshot.
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { getStartingDeck, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination } from "../types";

export type RunStartSnapshot = {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  freshDeck: BattleCard[];
  selectedDifficulty: DifficultyId | null;
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runTrinkets: string[];
  hasActiveRun: boolean;
};

export type RunStartInput = {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  difficultyId?: DifficultyId | null | undefined;
  talentStartGold: number;
  homesteadStartGold: number;
  homesteadStartMaxHealthBonus: number;
};

// Builds a coherent new-run state so every mode starts from a fresh, testable snapshot.
export function createRunStartSnapshot({
  characterId,
  contentSystemType,
  difficultyId = null,
  talentStartGold,
  homesteadStartGold,
  homesteadStartMaxHealthBonus,
}: RunStartInput): RunStartSnapshot {
  const runMaxHealth = MAX_PLAYER_HEALTH + homesteadStartMaxHealthBonus;
  const runGold = contentSystemType === "wildwood" ? 0 : talentStartGold + homesteadStartGold;

  return {
    characterId,
    contentSystemType,
    freshDeck: getStartingDeck(characterId),
    selectedDifficulty: contentSystemType === "campaign" ? difficultyId : null,
    runGold,
    runPlayerHealth: runMaxHealth,
    runMaxHealth,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    runTrinkets: [],
    hasActiveRun: contentSystemType !== "wildwood",
  };
}
