import { DEFAULT_BATTLE_ENEMY_TYPE, DEFAULT_CAMPAIGN_DIFFICULTY_ID } from "@/lib/game-constants";
import type { CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { BattleStartCommands } from "../stores/battle-start-commands";

export interface NoviceCampaignStartDeps {
  completedDifficulties: Record<string, DifficultyId[]>;
  initializeRunForDifficulty: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  getDifficultyModifiers: (characterId: CharacterId, difficultyId: DifficultyId) => DifficultyModifier[];
  startBattle: BattleStartCommands["startBattle"];
  navigateToBattle: () => void;
}

export function tryStartNoviceCampaignBattle(characterId: CharacterId, deps: NoviceCampaignStartDeps): boolean {
  const completed = deps.completedDifficulties[characterId] ?? [];
  if (completed.includes(DEFAULT_CAMPAIGN_DIFFICULTY_ID)) return false;

  deps.initializeRunForDifficulty(characterId, DEFAULT_CAMPAIGN_DIFFICULTY_ID);
  const modifiers = deps.getDifficultyModifiers(characterId, DEFAULT_CAMPAIGN_DIFFICULTY_ID);
  deps.startBattle({
    enemyType: DEFAULT_BATTLE_ENEMY_TYPE,
    modifiers,
    enemyId: "skeleton",
  });
  deps.navigateToBattle();
  return true;
}

export function afterCampaignCharacterResolved(
  characterId: CharacterId,
  deps: NoviceCampaignStartDeps,
  onContinue: () => void,
): void {
  if (tryStartNoviceCampaignBattle(characterId, deps)) return;
  onContinue();
}
