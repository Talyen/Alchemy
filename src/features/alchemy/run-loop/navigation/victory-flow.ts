import {
  sampleDestinationChoices,
  withSelectedBossForDestinations,
  type DestinationOfferState,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import {
  resolveAvailableDestinations,
  type DestinationEligibilityContext,
} from "@/features/alchemy/shared/run-flow/resolve-available-destinations";
import type { RewardState } from "@/lib/active-run-session";
import type { BattleSnapshot } from "@/lib/battle";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import {
  BOSS_GOLD_BONUS_FRACTION,
  ELITE_GOLD_BONUS_FRACTION,
  ENEMY_TRAIT_IDS,
  GOLD_REWARD_MAX,
  GOLD_REWARD_MIN,
  GOLD_TROVE_REWARD_MULTIPLIER,
} from "@/lib/game-constants";
import {
  computeTalentEffects,
  ENEMY_TYPES,
  getGoldMultiplier,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type TalentEffectManifest,
  type UnlockedTalents,
} from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { computeCombatMaterialReward } from "@/lib/homestead/material-rewards";
import type { HomesteadEffectManifest, MaterialInventory } from "@/lib/homestead/types";
import type { LootProgress } from "@/lib/loot";
import type { Destination } from "@/lib/routing";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import {
  createBossRewardState as createBossRewardStateFromFlow,
  createCombatRewardState as createCombatRewardStateFromFlow,
  createWildwoodRewardState,
} from "./reward-flow";
import {
  computeVictoryGold,
  getActiveRewardModifiersForContentSystem,
  getGenerousGoldBonus,
  getWealthyGoldBonus,
  getWellProvisionedHealing,
} from "./reward-math";

export interface VictoryRewardsInput {
  createInstanceId?: (() => string) | undefined;
  lootProgress: LootProgress;
  materialRewardBand: number;
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  unlockedTalents: UnlockedTalents;
  runDeck: BattleCard[];
  runBoons: string[];
  equippedTrinketId?: string | null;
  ownedTrinketIds?: string[];
  ownedUniqueIds?: ReadonlySet<string>;
  contentSystemType: ContentSystemId;
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
  battleState: BattleSnapshot;
  purseGold: number;
  runMaxHealth: number;
  destinationEligibility: DestinationEligibilityContext;
  homesteadEffects: HomesteadEffectManifest;
  rollBossEnemyId: () => string;
  destinationOfferState: DestinationOfferState;
}

export interface VictoryRewardsResult {
  rewardState: RewardState;
  labyrinthRewardModifiers: EncounterRewardTraitId[];

  goldEarned: number;

  persistedGold: number;
  playerHealth: number;
  destinationOfferState: DestinationOfferState;
}

interface VictoryGoldRoll {
  gold: number;
  eliteBonus: number;
  bossBonus: number;
  generousBonus: number;
  wealthyBonus: number;
}

function victoryGoldPerCombat(talentEffects: TalentEffectManifest, battleState: BattleSnapshot): number {
  return battleState.activeCompanion ? talentEffects.companionVictoryGold : 0;
}

function rollVictoryGold(
  battleState: BattleSnapshot,
  talentEffects: TalentEffectManifest,
  labyrinthRewardModifiers: EncounterRewardTraitId[],
  rng: () => number,
): VictoryGoldRoll {
  const baseGold = Math.floor(rng() * (GOLD_REWARD_MAX - GOLD_REWARD_MIN + 1) + GOLD_REWARD_MIN);
  let gold = Math.round(baseGold * (1 + talentEffects.enemyGoldDropBonus));

  if (battleState.currentEnemy.traits?.some((t) => t.id === ENEMY_TRAIT_IDS.GOLD_TROVE)) {
    gold = Math.round(gold * GOLD_TROVE_REWARD_MULTIPLIER);
  }

  const eliteBonus =
    battleState.currentEnemy.enemyType === ENEMY_TYPES.ELITE ? Math.round(gold * ELITE_GOLD_BONUS_FRACTION) : 0;
  const bossBonus =
    battleState.currentEnemy.enemyType === ENEMY_TYPES.BOSS ? Math.round(gold * BOSS_GOLD_BONUS_FRACTION) : 0;
  const generousBonus = getGenerousGoldBonus(labyrinthRewardModifiers, gold);
  const wealthyBonus = getWealthyGoldBonus(labyrinthRewardModifiers);

  return { gold, eliteBonus, bossBonus, generousBonus, wealthyBonus };
}

export function computeVictoryRewardState(
  input: Pick<
    VictoryRewardsInput,
    | "lootProgress"
    | "runDeck"
    | "runBoons"
    | "equippedTrinketId"
    | "ownedTrinketIds"
    | "ownedUniqueIds"
    | "createInstanceId"
    | "battleState"
    | "rollBossEnemyId"
  > & {
    goldPayout: number;
    materials: MaterialInventory;
    destinations: Destination[];
    gearAstralChanceBonus?: number;
    labyrinthRewardModifiers?: readonly EncounterRewardTraitId[];
  },
  rng: () => number,
): RewardState {
  const gearAstralChanceBonus = input.gearAstralChanceBonus ?? 0;
  const activeTrinketEffectIds = combineTrinketEffectIds(input.runBoons, input.equippedTrinketId ?? null);
  // Offer construction consumes the settled payout; it must not re-sum bonuses.
  const sharedFlowInput = {
    lootProgress: input.lootProgress,
    goldPayout: input.goldPayout,
    materials: input.materials,
    rng,
    createInstanceId: input.createInstanceId,
    excludedBoonIds: activeTrinketEffectIds,
    ownedTrinketIds: input.ownedTrinketIds ?? [],
    ownedUniqueIds: input.ownedUniqueIds ?? new Set(),
    gearAstralChanceBonus,
    rewardModifiers: input.labyrinthRewardModifiers ?? [],
  };

  if (input.battleState.currentEnemy.enemyType === ENEMY_TYPES.BOSS) {
    return createBossRewardStateFromFlow(sharedFlowInput);
  }

  return withSelectedBossForDestinations(
    input.destinations,
    createCombatRewardStateFromFlow({
      ...sharedFlowInput,
      battleState: input.battleState,
      runDeck: input.runDeck,
      destinations: input.destinations,
    }),
    input.rollBossEnemyId,
  );
}

function computeVictorySettlement(
  input: VictoryRewardsInput,
  talentEffects: TalentEffectManifest,
  activeTrinketEffectIds: string[],
  labyrinthRewardModifiers: EncounterRewardTraitId[],
  rng: () => number,
) {
  const goldRoll = rollVictoryGold(input.battleState, talentEffects, labyrinthRewardModifiers, rng);
  const goldResult = computeVictoryGold({
    battleState: input.battleState,
    purseGold: input.purseGold,
    runBoons: activeTrinketEffectIds,
    ...goldRoll,
    talentGoldPerCombat: victoryGoldPerCombat(talentEffects, input.battleState),
    goldMultiplier: getGoldMultiplier(input.characterId, input.selectedDifficulty),
    goldFindBonus: input.homesteadEffects.goldFindBonus,
  });
  const materials = computeCombatMaterialReward({
    progressionBand: input.materialRewardBand,
    enemyType: input.battleState.currentEnemy.enemyType,
    effects: input.homesteadEffects,
    scavenger: labyrinthRewardModifiers.includes("scavenger"),
    herbalist: labyrinthRewardModifiers.includes("herbalist"),
    rng,
  });
  const wellProvisionedHealing =
    input.contentSystemType === CONTENT_SYSTEMS.WILDWOOD
      ? 0
      : getWellProvisionedHealing(labyrinthRewardModifiers, input.runMaxHealth);
  const baseVictoryHealing = wellProvisionedHealing + Math.max(0, talentEffects.healthRestorePerCombat);
  const victoryHealing = baseVictoryHealing + (baseVictoryHealing > 0 ? talentEffects.homesteadHealing : 0);
  const playerHealth =
    input.contentSystemType === CONTENT_SYSTEMS.WILDWOOD || victoryHealing > 0
      ? Math.min(input.runMaxHealth, input.battleState.playerHealth + victoryHealing)
      : input.battleState.playerHealth;

  return { goldResult, materials, playerHealth };
}

function prepareVictoryDestinations(
  input: VictoryRewardsInput,
  playerHealth: number,
  persistedGold: number,
  destinationRng: () => number,
) {
  if (input.contentSystemType === CONTENT_SYSTEMS.LABYRINTH)
    return { choices: [] as Destination[], offerState: input.destinationOfferState };
  const eligibleDestinations = resolveAvailableDestinations({
    ...input.destinationEligibility,
    runPlayerHealth: playerHealth,
    gold: persistedGold,
    runMaxHealth: input.runMaxHealth,
  });
  return sampleDestinationChoices(eligibleDestinations, input.destinationOfferState, destinationRng);
}

export function computeVictoryRewards(
  input: VictoryRewardsInput,
  rng: () => number,
  destinationRng: () => number = rng,
): VictoryRewardsResult {
  const activeTrinketEffectIds = combineTrinketEffectIds(input.runBoons, input.equippedTrinketId ?? null);
  const labyrinthRewardModifiers = getActiveRewardModifiersForContentSystem(
    input.contentSystemType,
    input.activeLabyrinthRewardModifiers,
  );

  const talentEffects = mergeIntoManifest(computeTalentEffects(input.unlockedTalents), input.homesteadEffects);
  const settlement = computeVictorySettlement(
    input,
    talentEffects,
    activeTrinketEffectIds,
    labyrinthRewardModifiers,
    rng,
  );
  const commonResult = {
    labyrinthRewardModifiers,
    goldEarned: settlement.goldResult.earnedBeforeMultiplier,
    persistedGold: settlement.goldResult.persistedGold,
    playerHealth: settlement.playerHealth,
  };
  const goldPayout = settlement.goldResult.persistedGold - input.purseGold;
  if (input.contentSystemType === CONTENT_SYSTEMS.WILDWOOD) {
    return {
      ...commonResult,
      rewardState: {
        ...createWildwoodRewardState({
          runDeck: input.runDeck,
          createInstanceId: input.createInstanceId,
          rng,
          lootProgress: input.lootProgress,
          gearAstralChanceBonus: input.homesteadEffects.gearAstralChanceBonus,
          excludedBoonIds: activeTrinketEffectIds,
          ownedTrinketIds: input.ownedTrinketIds ?? [],
          ownedUniqueIds: input.ownedUniqueIds ?? new Set(),
        }),
        gold: goldPayout,
        materials: settlement.materials,
      },
      destinationOfferState: input.destinationOfferState,
    };
  }

  const sampled = prepareVictoryDestinations(
    input,
    settlement.playerHealth,
    settlement.goldResult.persistedGold,
    destinationRng,
  );
  const destinations = sampled.choices;

  const rewardState = computeVictoryRewardState(
    {
      lootProgress: input.lootProgress,
      createInstanceId: input.createInstanceId,
      runDeck: input.runDeck,
      runBoons: input.runBoons,
      equippedTrinketId: input.equippedTrinketId ?? null,
      ownedTrinketIds: input.ownedTrinketIds ?? [],
      ownedUniqueIds: input.ownedUniqueIds ?? new Set(),
      battleState: input.battleState,
      goldPayout,
      materials: settlement.materials,
      destinations,
      rollBossEnemyId: input.rollBossEnemyId,
      gearAstralChanceBonus: input.homesteadEffects.gearAstralChanceBonus,
      labyrinthRewardModifiers,
    },
    rng,
  );

  return {
    ...commonResult,
    rewardState,
    destinationOfferState: sampled.offerState,
  };
}
