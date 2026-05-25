// Pure victory reward computation extracted from use-run-navigation.
// Depends on: reward-flow, destination-flow, game data, game constants, homestead loot.
// Depended on by: useRunNavigation for computing battle victory outcomes.

import { computeTalentEffects, getGoldMultiplier } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, UnlockedTalents } from "@/lib/game-data";
import { randomBetween } from "@/features/alchemy/utils/random";
import { getEnemyMaterialLoot, applyMaterialFindBonus } from "@/lib/homestead/loot";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { CONSTANTS, type Destination } from "@/features/alchemy/types";
import type { ContentSystemId, LabyrinthModifierKind } from "@/lib/content-systems/types";
import {
  COMPANION_GOLD_FIND_CHANCE,
  COMPANION_GOLD_MULTIPLIER,
  ELITE_GOLD_BONUS_FRACTION,
  BOSS_GOLD_BONUS_FRACTION,
  GOLD_REWARD_MIN,
  GOLD_REWARD_MAX,
} from "@/lib/game-constants";
import {
  getActiveRewardModifiersForContentSystem,
  getGenerousGoldBonus,
  applyLabyrinthRewardMaterialModifiers,
  shouldForceTrinketReward,
  computeVictoryGoldResult,
  createCombatRewardState as createCombatRewardStateFromFlow,
  createBossRewardState as createBossRewardStateFromFlow,
  createEmptyRewardState,
  type RewardState,
} from "./reward-flow";
import { sampleDestinationChoices } from "./destination-flow";
import { getBossEnemy } from "@/features/alchemy/config";

export type VictoryRewardsInput = {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  unlockedTalents: UnlockedTalents;
  runDeck: BattleCard[];
  runTrinkets: string[];
  contentSystemType: ContentSystemId;
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  battleState: BattleState;
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  homesteadEffects: HomesteadEffectManifest;
  getAvailableDestinations: (options?: {
    currentHealth?: number;
    currentGold?: number;
    destinationIndexInAct?: number;
    maxHealth?: number;
  }) => Destination[];
};

export type VictoryRewardsResult = {
  newGold: number;
  rewardState: RewardState;
  labyrinthRewardModifiers: LabyrinthModifierKind[];
  destinations: Destination[];
  materials: MaterialInventory;
  goldEarned: number;
  playerHealth: number;
  maxHealthDelta: number;
  baseGold: number;
  eliteBonus: number;
  bossBonus: number;
  generousBonus: number;
};

const VICTORY_CONSTANTS = {
  BASE_MULTIPLIER_OFFSET: 1,
  ZERO: 0,
} as const;

export function withSelectedBossForDestinations(destinations: Destination[], rewardState: RewardState): RewardState {
  if (destinations.length === 1 && destinations[0] === CONSTANTS.DESTINATIONS.BOSS_COMBAT) {
    return { ...rewardState, selectedBossId: rewardState.selectedBossId ?? getBossEnemy().id };
  }
  return { ...rewardState, selectedBossId: null };
}

export function createDestinationRewardState(destinations: Destination[]): RewardState {
  return withSelectedBossForDestinations(destinations, createEmptyRewardState(destinations));
}

export function computeVictoryRewardState(input: {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  unlockedTalents: UnlockedTalents;
  runDeck: BattleCard[];
  runTrinkets: string[];
  contentSystemType: ContentSystemId;
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  battleState: BattleState;
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  bossBonus: number;
  materials: MaterialInventory;
  destinations: Destination[];
}): RewardState {
  const talentEffects = computeTalentEffects(input.unlockedTalents);
  const goldMultiplier = getGoldMultiplier(input.characterId, input.selectedDifficulty);

  if (input.battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.BOSS) {
    return createBossRewardStateFromFlow({
      gold: input.gold,
      bossBonus: input.bossBonus,
      generousBonus: input.generousBonus,
      talentGoldPerCombat: talentEffects.goldPerCombat,
      materials: input.materials,
      trinketIds: input.runTrinkets,
      goldMultiplier,
    });
  }

  return withSelectedBossForDestinations(
    input.destinations,
    createCombatRewardStateFromFlow({
      battleState: input.battleState,
      runDeck: input.runDeck,
      gold: input.gold,
      eliteBonus: input.eliteBonus,
      generousBonus: input.generousBonus,
      talentGoldPerCombat: talentEffects.goldPerCombat,
      materials: input.materials,
      destinations: input.destinations,
      trinketIds: input.runTrinkets,
      goldMultiplier,
      forceTrinket: shouldForceTrinketReward(
        getActiveRewardModifiersForContentSystem(input.contentSystemType, input.activeLabyrinthRewardModifiers),
      ),
    }),
  );
}

export function computeVictoryRewards(input: VictoryRewardsInput): VictoryRewardsResult {
  const labyrinthRewardModifiers = getActiveRewardModifiersForContentSystem(
    input.contentSystemType,
    input.activeLabyrinthRewardModifiers,
  );

  const talentEffects = computeTalentEffects(input.unlockedTalents);

  const baseGold = randomBetween(GOLD_REWARD_MIN, GOLD_REWARD_MAX);

  let gold = Math.floor(baseGold * (VICTORY_CONSTANTS.BASE_MULTIPLIER_OFFSET + talentEffects.enemyGoldDropBonus));

  if (
    talentEffects.companionGoldFindActive &&
    input.battleState.activeCompanion &&
    Math.random() < COMPANION_GOLD_FIND_CHANCE
  ) {
    gold = Math.floor(gold * COMPANION_GOLD_MULTIPLIER);
  }

  const eliteFraction =
    ELITE_GOLD_BONUS_FRACTION +
    (input.battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE
      ? talentEffects.eliteGoldDropBonus
      : VICTORY_CONSTANTS.ZERO);
  const eliteBonus =
    input.battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE
      ? Math.floor(gold * eliteFraction)
      : VICTORY_CONSTANTS.ZERO;
  const bossBonus =
    input.battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.BOSS
      ? Math.floor(gold * BOSS_GOLD_BONUS_FRACTION)
      : VICTORY_CONSTANTS.ZERO;
  const generousBonus = getGenerousGoldBonus(labyrinthRewardModifiers, gold);

  const goldResult = computeVictoryGoldResult({
    battleState: input.battleState,
    runGold: input.runGold,
    runTrinkets: input.runTrinkets,
    gold,
    eliteBonus,
    generousBonus,
    bossBonus,
    talentGoldPerCombat: talentEffects.goldPerCombat,
    goldMultiplier: getGoldMultiplier(input.characterId, input.selectedDifficulty),
  });

  const newGold = input.runGold + goldResult.earnedBeforeMultiplier;

  const playerHealth = input.battleState.playerHealth;
  const maxHealthDelta =
    talentEffects.maxHealthPerCombat > VICTORY_CONSTANTS.ZERO ? talentEffects.maxHealthPerCombat : 0;

  const baseMaterials = getEnemyMaterialLoot(
    input.battleState.currentEnemy.id,
    input.battleState.currentEnemy.enemyType,
  );
  const materials = applyLabyrinthRewardMaterialModifiers(
    applyMaterialFindBonus(baseMaterials, input.homesteadEffects),
    labyrinthRewardModifiers,
  );

  const previousDestination =
    input.destinationIndexInAct === 0 ? undefined : input.completedDestinations[input.completedDestinations.length - 1];
  const destinations = sampleDestinationChoices(
    input.getAvailableDestinations({
      currentHealth: input.battleState.playerHealth,
      currentGold: newGold,
      destinationIndexInAct: input.destinationIndexInAct,
      maxHealth: input.runMaxHealth,
    }),
    previousDestination,
  );

  const rewardState = computeVictoryRewardState({
    characterId: input.characterId,
    selectedDifficulty: input.selectedDifficulty,
    unlockedTalents: input.unlockedTalents,
    runDeck: input.runDeck,
    runTrinkets: input.runTrinkets,
    contentSystemType: input.contentSystemType,
    activeLabyrinthRewardModifiers: input.activeLabyrinthRewardModifiers,
    battleState: input.battleState,
    gold,
    eliteBonus,
    generousBonus,
    bossBonus,
    materials,
    destinations,
  });

  return {
    newGold,
    rewardState,
    labyrinthRewardModifiers,
    destinations,
    materials,
    goldEarned: goldResult.earnedBeforeMultiplier,
    playerHealth,
    maxHealthDelta,
    baseGold,
    eliteBonus,
    bossBonus,
    generousBonus,
  };
}
