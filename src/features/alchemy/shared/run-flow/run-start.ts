import {
  cloneBattleCard,
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type TalentXP,
} from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination } from "@/lib/routing";
import { computeRunMaxHealth } from "./run-max-health";

export interface RunStartSnapshot {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  freshDeck: BattleCard[];
  selectedDifficulty: DifficultyId | null;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runBoons: string[];
  hasActiveRun: boolean;
}

export interface RunStartInput {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  difficultyId?: DifficultyId | null | undefined;
  talentXP: TalentXP;
  draftedDeck?: BattleCard[] | undefined;
  gearMaxHealthBonus?: number;
  homesteadMaxHealthBonus?: number;
}

export function createRunStartSnapshot({
  characterId,
  contentSystemType,
  difficultyId = null,
  talentXP,
  draftedDeck,
  gearMaxHealthBonus = 0,
  homesteadMaxHealthBonus = 0,
}: RunStartInput): RunStartSnapshot {
  const runMaxHealth = computeRunMaxHealth(talentXP, gearMaxHealthBonus, homesteadMaxHealthBonus);

  return {
    characterId,
    contentSystemType,
    freshDeck: (draftedDeck ?? getStartingDeck(characterId)).map(cloneBattleCard),
    selectedDifficulty: contentSystemType === "campaign" ? difficultyId : null,
    runPlayerHealth: runMaxHealth,
    runMaxHealth,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    runBoons: [],
    hasActiveRun: true,
  };
}
