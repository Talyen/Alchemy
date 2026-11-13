import {
  cloneBattleCard,
  computeStartingMaxHealth,
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type TalentXP,
} from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { PersistedRunProgress } from "@/lib/active-run-session";

/** Only the selected starting loadout belongs here; progress defaults have one owner. */
export type RunStartSnapshot = Pick<
  PersistedRunProgress,
  "characterId" | "contentSystemType" | "runDeck" | "selectedDifficulty" | "runPlayerHealth" | "runMaxHealth"
>;

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
  const runMaxHealth = computeStartingMaxHealth(talentXP) + gearMaxHealthBonus + homesteadMaxHealthBonus;

  return {
    characterId,
    contentSystemType,
    runDeck: (draftedDeck ?? getStartingDeck(characterId)).map(cloneBattleCard),
    selectedDifficulty: contentSystemType === "campaign" ? difficultyId : null,
    runPlayerHealth: runMaxHealth,
    runMaxHealth,
  };
}
