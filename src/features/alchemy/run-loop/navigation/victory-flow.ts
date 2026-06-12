// Pure victory reward computation extracted from use-run-navigation.
// Depends on: reward-flow, destination-flow, game data, game constants, homestead loot.
// Depended on by: useRunNavigation for computing battle victory outcomes.

import { computeTalentEffects, getGoldMultiplier } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, UnlockedTalents, TalentEffectManifest } from "@/lib/game-data";
import { getEnemyMaterialLoot, applyMaterialFindBonus } from "@/lib/homestead/loot";
import { randomInt } from "@/lib/utils";
import {
  COMPANION_GOLD_FIND_CHANCE,
  COMPANION_GOLD_MULTIPLIER,
  ELITE_GOLD_BONUS_FRACTION,
  BOSS_GOLD_BONUS_FRACTION,
  ENEMY_TRAIT_IDS,
  GOLD_REWARD_MIN,
  GOLD_REWARD_MAX,
  GOLD_TROVE_REWARD_MULTIPLIER,
} from "@/lib/game-constants";
import { getGenerousGoldBonus } from "./reward-flow";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { CONSTANTS, type Destination } from "@/features/alchemy/shared/types";
import { syncBattleToRun } from "@/features/alchemy/shared/stores/run-transitions";
import type { ContentSystemId, LabyrinthModifierKind } from "@/lib/content-systems/types";
import {
  getActiveRewardModifiersForContentSystem,
  applyLabyrinthRewardMaterialModifiers,
  shouldForceTrinketReward,
  computeVictoryGoldResult,
  createCombatRewardState as createCombatRewardStateFromFlow,
  createBossRewardState as createBossRewardStateFromFlow,
  createEmptyRewardState,
  createWildwoodRewardState,
  getCompanionCardChoices,
  shouldGrantCompanionReward,
  type RewardState,
} from "./reward-flow";
import { sampleDestinationChoices } from "./destination-flow";
import { getPreviousDestination } from "./run-navigation-helpers";
import { playGoldGain } from "@/lib/audio";

type VictoryGoldRoll = {
  gold: number;
  eliteBonus: number;
  bossBonus: number;
  generousBonus: number;
  baseGold: number;
};

function rollVictoryGold(
  battleState: BattleState,
  talentEffects: TalentEffectManifest,
  labyrinthRewardModifiers: LabyrinthModifierKind[],
  rng: () => number,
): VictoryGoldRoll {
  const baseGold = randomInt(GOLD_REWARD_MIN, GOLD_REWARD_MAX);
  let gold = Math.floor(baseGold * (1 + talentEffects.enemyGoldDropBonus));

  if (talentEffects.companionGoldFindActive && battleState.activeCompanion && rng() < COMPANION_GOLD_FIND_CHANCE) {
    gold = Math.floor(gold * COMPANION_GOLD_MULTIPLIER);
  }

  if (battleState.currentEnemy.traits?.some((t) => t.id === ENEMY_TRAIT_IDS.GOLD_TROVE)) {
    gold = Math.floor(gold * GOLD_TROVE_REWARD_MULTIPLIER);
  }

  const eliteFraction =
    ELITE_GOLD_BONUS_FRACTION +
    (battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE ? talentEffects.eliteGoldDropBonus : 0);
  const eliteBonus =
    battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE ? Math.floor(gold * eliteFraction) : 0;
  const bossBonus =
    battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.BOSS ? Math.floor(gold * BOSS_GOLD_BONUS_FRACTION) : 0;
  const generousBonus = getGenerousGoldBonus(labyrinthRewardModifiers, gold);

  return { gold, eliteBonus, bossBonus, generousBonus, baseGold };
}

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
  bossEnemyId?: string | null | undefined;
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

export function withSelectedBossForDestinations(
  destinations: Destination[],
  rewardState: RewardState,
  bossEnemyId?: string | null,
): RewardState {
  if (destinations.length === 1 && destinations[0] === CONSTANTS.DESTINATIONS.BOSS_COMBAT) {
    return { ...rewardState, selectedBossId: rewardState.selectedBossId ?? bossEnemyId ?? null };
  }
  return { ...rewardState, selectedBossId: null };
}

export function createDestinationRewardState(destinations: Destination[], bossEnemyId?: string | null): RewardState {
  return withSelectedBossForDestinations(destinations, createEmptyRewardState(destinations), bossEnemyId);
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
  talentEffects?: TalentEffectManifest;
  bossEnemyId?: string | null | undefined;
}): RewardState {
  const talentEffects = input.talentEffects ?? computeTalentEffects(input.unlockedTalents);
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
    input.bossEnemyId,
  );
}

export function computeVictoryRewards(
  input: VictoryRewardsInput,
  rng: () => number = Math.random,
): VictoryRewardsResult {
  const labyrinthRewardModifiers = getActiveRewardModifiersForContentSystem(
    input.contentSystemType,
    input.activeLabyrinthRewardModifiers,
  );

  const talentEffects = computeTalentEffects(input.unlockedTalents);
  if (input.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    return {
      newGold: input.runGold,
      rewardState: createWildwoodRewardState(input.runDeck, rng),
      labyrinthRewardModifiers: [],
      destinations: [],
      materials: emptyInventory(),
      goldEarned: 0,
      playerHealth: input.battleState.playerHealth,
      maxHealthDelta: talentEffects.maxHealthPerCombat > 0 ? talentEffects.maxHealthPerCombat : 0,
      baseGold: 0,
      eliteBonus: 0,
      bossBonus: 0,
      generousBonus: 0,
    };
  }
  const { gold, eliteBonus, bossBonus, generousBonus, baseGold } = rollVictoryGold(
    input.battleState,
    talentEffects,
    labyrinthRewardModifiers,
    rng,
  );

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

  const newGold = goldResult.persistedRunGold;

  const playerHealth = input.battleState.playerHealth;
  const maxHealthDelta = talentEffects.maxHealthPerCombat > 0 ? talentEffects.maxHealthPerCombat : 0;

  const baseMaterials = getEnemyMaterialLoot(
    input.battleState.currentEnemy.id,
    input.battleState.currentEnemy.enemyType,
  );
  const materials = applyLabyrinthRewardMaterialModifiers(
    applyMaterialFindBonus(baseMaterials, input.homesteadEffects),
    labyrinthRewardModifiers,
  );

  const previousDestination = getPreviousDestination(input.destinationIndexInAct, input.completedDestinations);
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
    talentEffects,
    bossEnemyId: input.bossEnemyId,
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

export type CommitVictoryRewardsDeps = {
  battleState: BattleState;
  contentSystemType: ContentSystemId;
  addHomesteadMaterials: (materials: MaterialInventory) => void;
  addRunGold: (amount: number) => void;
  setRunMaxHealth: (fn: (prev: number) => number) => void;
  setRewardState: (state: RewardState) => void;
  setCompanionRewardCards: (cards: BattleCard[] | null) => void;
  clearCombatState: () => void;
};

export function commitVictoryRewards(result: VictoryRewardsResult, deps: CommitVictoryRewardsDeps) {
  if (deps.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD && deps.battleState.pendingMaterials.crystal > 0) {
    deps.addHomesteadMaterials(deps.battleState.pendingMaterials);
  }

  deps.addRunGold(result.goldEarned);
  syncBattleToRun({ playerHealth: result.playerHealth });
  if (result.maxHealthDelta > 0) {
    deps.setRunMaxHealth((prev) => prev + result.maxHealthDelta);
  }

  if (result.newGold > deps.battleState.gold) {
    playGoldGain();
  }

  deps.setRewardState({
    ...result.rewardState,
    lastVictoryEnemyType: deps.battleState.currentEnemy.enemyType,
    lastVictoryContentSystem: deps.contentSystemType,
  });
  if (shouldGrantCompanionReward(result.labyrinthRewardModifiers)) {
    deps.setCompanionRewardCards(getCompanionCardChoices());
  } else {
    deps.setCompanionRewardCards(null);
  }
  deps.clearCombatState();
}
