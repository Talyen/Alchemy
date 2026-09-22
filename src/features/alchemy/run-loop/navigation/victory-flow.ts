import {
  sampleDestinationChoices,
  withSelectedBossForDestinations,
  type DestinationOfferState,
  type DestinationOptionsInput,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import type { RewardState } from "@/lib/active-run-session";
import type { BattleSnapshot } from "@/lib/battle";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import {
  BOSS_GOLD_BONUS_FRACTION,
  COMPANION_GOLD_FIND_CHANCE_FRACTION,
  COMPANION_GOLD_MULTIPLIER,
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
  lootProgress: LootProgress;
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
  destinationIndexInAct: number;
  homesteadEffects: HomesteadEffectManifest;
  getAvailableDestinations: (options?: DestinationOptionsInput) => Destination[];
  bossEnemyId?: string | null | undefined;
  destinationOfferState: DestinationOfferState;
}

export interface VictoryRewardsResult {
  rewardState: RewardState;
  labyrinthRewardModifiers: EncounterRewardTraitId[];

  goldEarned: number;

  persistedGold: number;
  playerHealth: number;
  maxHealthDelta: number;
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
  return talentEffects.goldPerCombat + (battleState.activeCompanion ? talentEffects.companionVictoryGold : 0);
}

function rollVictoryGold(
  battleState: BattleSnapshot,
  talentEffects: TalentEffectManifest,
  labyrinthRewardModifiers: EncounterRewardTraitId[],
  rng: () => number,
): VictoryGoldRoll {
  const baseGold = Math.floor(rng() * (GOLD_REWARD_MAX - GOLD_REWARD_MIN + 1) + GOLD_REWARD_MIN);
  let gold = Math.round(baseGold * (1 + talentEffects.enemyGoldDropBonus));

  if (
    talentEffects.companionGoldFindActive &&
    battleState.activeCompanion &&
    rng() < COMPANION_GOLD_FIND_CHANCE_FRACTION
  ) {
    gold = Math.round(gold * COMPANION_GOLD_MULTIPLIER);
  }

  if (battleState.currentEnemy.traits?.some((t) => t.id === ENEMY_TRAIT_IDS.GOLD_TROVE)) {
    gold = Math.round(gold * GOLD_TROVE_REWARD_MULTIPLIER);
  }

  const eliteFraction =
    ELITE_GOLD_BONUS_FRACTION +
    (battleState.currentEnemy.enemyType === ENEMY_TYPES.ELITE ? talentEffects.eliteGoldDropBonus : 0);
  const eliteBonus = battleState.currentEnemy.enemyType === ENEMY_TYPES.ELITE ? Math.round(gold * eliteFraction) : 0;
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
    | "characterId"
    | "selectedDifficulty"
    | "unlockedTalents"
    | "runDeck"
    | "runBoons"
    | "equippedTrinketId"
    | "ownedTrinketIds"
    | "ownedUniqueIds"
    | "battleState"
    | "bossEnemyId"
  > & {
    gold: number;
    eliteBonus: number;
    generousBonus: number;
    wealthyBonus: number;
    bossBonus: number;
    materials: MaterialInventory;
    destinations: Destination[];
    talentEffects?: TalentEffectManifest;
    gearAstralChanceBonus?: number;
    purseGold?: number;
  },
  rng: () => number,
): RewardState {
  const talentEffects = input.talentEffects ?? computeTalentEffects(input.unlockedTalents);
  const goldMultiplier = getGoldMultiplier(input.characterId, input.selectedDifficulty);
  const gearAstralChanceBonus = input.gearAstralChanceBonus ?? 0;
  const activeTrinketEffectIds = combineTrinketEffectIds(input.runBoons, input.equippedTrinketId ?? null);
  const inCombatGold = input.purseGold !== undefined ? Math.max(0, input.battleState.gold - input.purseGold) : 0;
  // Boss and combat rewards share every input except the encounter bonus and
  // the combat-only deck/elite/destination fields.
  const sharedFlowInput = {
    lootProgress: input.lootProgress,
    gold: input.gold,
    generousBonus: input.generousBonus,
    wealthyBonus: input.wealthyBonus,
    talentGoldPerCombat: victoryGoldPerCombat(talentEffects, input.battleState),
    materials: input.materials,
    trinketIds: activeTrinketEffectIds,
    goldMultiplier,
    rng,
    excludedBoonIds: activeTrinketEffectIds,
    ownedTrinketIds: input.ownedTrinketIds ?? [],
    ownedUniqueIds: input.ownedUniqueIds ?? new Set(),
    gearAstralChanceBonus,
    inCombatGold,
  };

  if (input.battleState.currentEnemy.enemyType === ENEMY_TYPES.BOSS) {
    return createBossRewardStateFromFlow({
      ...sharedFlowInput,
      bossBonus: input.bossBonus,
    });
  }

  return withSelectedBossForDestinations(
    input.destinations,
    createCombatRewardStateFromFlow({
      ...sharedFlowInput,
      battleState: input.battleState,
      runDeck: input.runDeck,
      eliteBonus: input.eliteBonus,
      destinations: input.destinations,
    }),
    input.bossEnemyId,
  );
}

// Gauntlet economy: Wildwood gold is purse-vs-battle plus companion bonus only,
// deliberately ignoring the difficulty/talent/elite multipliers campaign and
// labyrinth apply in computeVictoryGold below. Modifiers still pass through
// untouched so the companion second-stage in victory-commands keeps working;
// every other modifier is intentionally ignored here.
function computeWildwoodVictoryRewards(
  input: VictoryRewardsInput,
  talentEffects: TalentEffectManifest,
  activeTrinketEffectIds: string[],
  labyrinthRewardModifiers: EncounterRewardTraitId[],
  rng: () => number,
): VictoryRewardsResult {
  const companionGold = input.battleState.activeCompanion ? talentEffects.companionVictoryGold : 0;
  const goldEarned = Math.max(0, input.battleState.gold - input.purseGold) + companionGold;
  const maxHealthDelta = Math.max(0, talentEffects.maxHealthPerCombat);
  const effectiveMaxHealth = input.runMaxHealth + maxHealthDelta;
  const playerHealth = Math.min(
    effectiveMaxHealth,
    input.battleState.playerHealth + Math.max(0, talentEffects.healthRestorePerCombat),
  );
  return {
    rewardState: createWildwoodRewardState({
      runDeck: input.runDeck,
      rng,
      lootProgress: input.lootProgress,
      gearAstralChanceBonus: input.homesteadEffects.gearAstralChanceBonus,
      excludedBoonIds: activeTrinketEffectIds,
      ownedTrinketIds: input.ownedTrinketIds ?? [],
      ownedUniqueIds: input.ownedUniqueIds ?? new Set(),
    }),
    labyrinthRewardModifiers,
    goldEarned,
    persistedGold: Math.max(input.purseGold, input.battleState.gold) + companionGold,
    playerHealth,
    maxHealthDelta,
    destinationOfferState: input.destinationOfferState,
  };
}

function prepareVictoryDestinations(
  input: VictoryRewardsInput,
  playerHealth: number,
  persistedGold: number,
  effectiveMaxHealth: number,
  destinationRng: () => number,
) {
  const skipDestinationSampling = input.contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
  const eligibleDestinations = skipDestinationSampling
    ? []
    : input.getAvailableDestinations({
        currentHealth: playerHealth,
        currentGold: persistedGold,
        destinationIndexInAct: input.destinationIndexInAct,
        maxHealth: effectiveMaxHealth,
      });
  const sampled = skipDestinationSampling
    ? { choices: [] as Destination[], offerState: input.destinationOfferState }
    : sampleDestinationChoices(eligibleDestinations, input.destinationOfferState, destinationRng);
  return sampled;
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

  const talentEffects = computeTalentEffects(input.unlockedTalents);
  if (input.contentSystemType === CONTENT_SYSTEMS.WILDWOOD) {
    return computeWildwoodVictoryRewards(input, talentEffects, activeTrinketEffectIds, labyrinthRewardModifiers, rng);
  }
  const { gold, eliteBonus, bossBonus, generousBonus, wealthyBonus } = rollVictoryGold(
    input.battleState,
    talentEffects,
    labyrinthRewardModifiers,
    rng,
  );

  const goldResult = computeVictoryGold({
    battleState: input.battleState,
    purseGold: input.purseGold,
    runBoons: activeTrinketEffectIds,
    gold,
    eliteBonus,
    generousBonus,
    wealthyBonus,
    bossBonus,
    talentGoldPerCombat: victoryGoldPerCombat(talentEffects, input.battleState),
    goldMultiplier: getGoldMultiplier(input.characterId, input.selectedDifficulty),
  });

  const maxHealthDelta = Math.max(0, talentEffects.maxHealthPerCombat);
  const effectiveMaxHealth = input.runMaxHealth + maxHealthDelta;
  const wellProvisionedHealing = getWellProvisionedHealing(labyrinthRewardModifiers, effectiveMaxHealth);
  const victoryHealing = wellProvisionedHealing + Math.max(0, talentEffects.healthRestorePerCombat);
  const playerHealth =
    victoryHealing > 0
      ? Math.min(effectiveMaxHealth, input.battleState.playerHealth + victoryHealing)
      : input.battleState.playerHealth;

  const materials = computeCombatMaterialReward({
    enemyId: input.battleState.currentEnemy.id,
    enemyType: input.battleState.currentEnemy.enemyType,
    effects: input.homesteadEffects,
    scavenger: labyrinthRewardModifiers.includes("scavenger"),
    herbalist: labyrinthRewardModifiers.includes("herbalist"),
    rng,
  });

  const sampled = prepareVictoryDestinations(
    input,
    playerHealth,
    goldResult.persistedGold,
    effectiveMaxHealth,
    destinationRng,
  );
  const destinations = sampled.choices;

  const rewardState = computeVictoryRewardState(
    {
      lootProgress: input.lootProgress,
      characterId: input.characterId,
      selectedDifficulty: input.selectedDifficulty,
      unlockedTalents: input.unlockedTalents,
      runDeck: input.runDeck,
      runBoons: input.runBoons,
      equippedTrinketId: input.equippedTrinketId ?? null,
      ownedTrinketIds: input.ownedTrinketIds ?? [],
      ownedUniqueIds: input.ownedUniqueIds ?? new Set(),
      battleState: input.battleState,
      purseGold: input.purseGold,
      gold,
      eliteBonus,
      generousBonus,
      wealthyBonus,
      bossBonus,
      materials,
      destinations,
      talentEffects,
      bossEnemyId: input.bossEnemyId,
      gearAstralChanceBonus: input.homesteadEffects.gearAstralChanceBonus,
    },
    rng,
  );

  return {
    rewardState,
    labyrinthRewardModifiers,
    goldEarned: goldResult.earnedBeforeMultiplier,
    persistedGold: goldResult.persistedGold,
    playerHealth,
    maxHealthDelta,
    destinationOfferState: sampled.offerState,
  };
}
