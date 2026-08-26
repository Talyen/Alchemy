// Shared run-navigation helpers for destination history and campaign novice starts.
// Used by useRunFlowEngine and victory-flow to avoid duplicated ternaries and start blocks.
import { DEFAULT_BATTLE_ENEMY_TYPE, DEFAULT_CAMPAIGN_DIFFICULTY_ID } from "@/lib/game-constants";
import type { BattleCard, CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { Destination } from "@/lib/routing";
export function getPreviousDestination(
  destinationIndexInAct: number,
  completedDestinations: Destination[],
): Destination | undefined {
  return destinationIndexInAct === 0 ? undefined : completedDestinations[completedDestinations.length - 1];
}

interface NoviceCampaignStartDeps {
  completedDifficulties: Record<string, DifficultyId[]>;
  initializeRunForDifficulty: (
    characterId: CharacterId,
    difficultyId: DifficultyId,
  ) => { freshDeck: BattleCard[]; totalStartGold: number };
  getDifficultyModifiers: (characterId: CharacterId, difficultyId: DifficultyId) => DifficultyModifier[];
  onStartBattle: (
    deck: BattleCard[],
    gold: number,
    enemyType: typeof DEFAULT_BATTLE_ENEMY_TYPE,
    modifiers: DifficultyModifier[],
  ) => void;
  navigateToBattle: () => void;
}

export function tryStartNoviceCampaignBattle(characterId: CharacterId, deps: NoviceCampaignStartDeps): boolean {
  const completed = deps.completedDifficulties[characterId] ?? [];
  if (completed.includes(DEFAULT_CAMPAIGN_DIFFICULTY_ID)) return false;

  const { freshDeck, totalStartGold } = deps.initializeRunForDifficulty(characterId, DEFAULT_CAMPAIGN_DIFFICULTY_ID);
  const modifiers = deps.getDifficultyModifiers(characterId, DEFAULT_CAMPAIGN_DIFFICULTY_ID);
  deps.onStartBattle(freshDeck, totalStartGold, DEFAULT_BATTLE_ENEMY_TYPE, modifiers);
  deps.navigateToBattle();
  return true;
}

/** Skips novice auto-start when already completed; otherwise runs `onContinue` (difficulty select, etc.). */
export function afterCampaignCharacterResolved(
  characterId: CharacterId,
  deps: NoviceCampaignStartDeps,
  onContinue: () => void,
): void {
  if (tryStartNoviceCampaignBattle(characterId, deps)) return;
  onContinue();
}
