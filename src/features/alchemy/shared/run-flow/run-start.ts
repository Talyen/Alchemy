// Pure run-start snapshot builder for campaign, labyrinth, and wildwood entry points.
// Lives in shared/run-flow so run-setup and shared/stores can both consume it without
// a phase → stores ownership inversion.
import {
  computeStartingMaxHealth,
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type TalentXP,
} from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination } from "@/features/alchemy/shared/types";

export interface RunStartSnapshot {
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

// Builds a coherent new-run state so every mode starts from a fresh, testable snapshot.
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
  const runMaxHealth = computeStartingMaxHealth(talentXP) + gearMaxHealthBonus + homesteadMaxHealthBonus;
  const runGold = contentSystemType === "wildwood" ? 0 : talentStartGold;

  return {
    characterId,
    contentSystemType,
    freshDeck: draftedDeck ?? getStartingDeck(characterId),
    selectedDifficulty: contentSystemType === "campaign" ? difficultyId : null,
    runGold,
    runPlayerHealth: runMaxHealth,
    runMaxHealth,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    runTrinkets: [],
    hasActiveRun: true,
  };
}
