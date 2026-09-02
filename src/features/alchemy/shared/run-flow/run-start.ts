import { getStartingDeck, type BattleCard, type CharacterId, type DifficultyId, type TalentXP } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination } from "@/lib/routing";
import { computeRunMaxHealth } from "./run-max-health";

export interface RunStartSnapshot {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  freshDeck: BattleCard[];
  selectedDifficulty: DifficultyId | null;
  startGoldGrant: number;
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
  talentStartGold: number;
  talentXP: TalentXP;
  draftedDeck?: BattleCard[] | undefined;
  gearMaxHealthBonus?: number;
  homesteadMaxHealthBonus?: number;
}

export function createRunStartSnapshot({
  characterId,
  contentSystemType,
  difficultyId = null,
  talentStartGold,
  talentXP,
  draftedDeck,
  gearMaxHealthBonus = 0,
  homesteadMaxHealthBonus = 0,
}: RunStartInput): RunStartSnapshot {
  const runMaxHealth = computeRunMaxHealth(talentXP, gearMaxHealthBonus, homesteadMaxHealthBonus);

  return {
    characterId,
    contentSystemType,
    freshDeck: draftedDeck ?? getStartingDeck(characterId),
    selectedDifficulty: contentSystemType === "campaign" ? difficultyId : null,
    startGoldGrant: talentStartGold,
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
