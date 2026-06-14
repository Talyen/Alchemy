// Pure run-start snapshot builder for campaign, labyrinth, and wildwood entry points.
// Depends on character starter decks and Health constants; React controllers apply the snapshot.
import {
  computeStartingMaxHealth,
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type TalentXP,
} from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination } from "../../shared/types";

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
  runBoons: string[];
  hasActiveRun: boolean;
};

export type RunStartInput = {
  characterId: CharacterId;
  contentSystemType: ContentSystemId;
  difficultyId?: DifficultyId | null | undefined;
  talentStartGold: number;
  talentXP: TalentXP;
  draftedDeck?: BattleCard[] | undefined;
};

// Builds a coherent new-run state so every mode starts from a fresh, testable snapshot.
export function createRunStartSnapshot({
  characterId,
  contentSystemType,
  difficultyId = null,
  talentStartGold,
  talentXP,
  draftedDeck,
}: RunStartInput): RunStartSnapshot {
  const runMaxHealth = computeStartingMaxHealth(talentXP);
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
    runBoons: [],
    hasActiveRun: true,
  };
}
