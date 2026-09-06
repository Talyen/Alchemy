import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import {
  BOSS_REWARD_RATES,
  ENCOUNTER_REWARD_RATES,
  GEAR_REWARD_PERMANENT_TRINKET_CHANCE,
  LABYRINTH_REWARD_CONFIG,
  REWARD_CARD_CHOICES,
} from "@/lib/game-constants";
import { pickRandom, sampleItems } from "@/lib/utils";
import {
  generateGearRewardChoices,
  generateGearRewardChoicesForRarities,
  rollGearRewardDropTier,
  type GearRarity,
} from "@/lib/gear";
import {
  createEmptyRewardState,
  resolveRewardChoice,
  type CardRewardState,
  type BoonRewardState,
  type GearRewardState,
  type RewardState,
  type TrinketRewardState,
} from "@/lib/active-run-session";

export {
  shouldGrantCompanionReward,
  shouldGrantAlchemistReward,
  getActiveRewardModifiersForContentSystem,
  getGenerousGoldBonus,
  getWealthyGoldBonus,
  getWellProvisionedHealing,
  applyLabyrinthRewardMaterialModifiers,
  computeVictoryGold,
} from "./reward-math";

import { computeRewardGold } from "./reward-math";
import type {
  BossRewardInput,
  CombatRewardInput,
  CombatRewardCategory,
  FinalizeRewardInput,
  FinalizeRewardResult,
  FinalizeRewardRoute,
} from "./reward-flow-types";
import { REWARD_ROUTES } from "@/lib/routing";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import {
  ENEMY_TYPES,
  cardLibrary,
  selectRewardCards,
  trinketLibrary,
  type BattleCard,
  type TrinketEntry,
} from "@/lib/game-data";

function sampleTrinketRewardChoices(excludedIds: readonly string[], rng: () => number): TrinketEntry[] {
  const excluded = new Set(excludedIds);
  return sampleItems(
    trinketLibrary.filter((entry) => !excluded.has(entry.id)),
    REWARD_CARD_CHOICES,
    rng,
  );
}

function samplePermanentTrinketRewardChoices(ownedIds: readonly string[], rng: () => number): TrinketEntry[] {
  const owned = new Set(ownedIds);
  return sampleItems(
    trinketLibrary.filter((entry) => !owned.has(entry.id)),
    REWARD_CARD_CHOICES,
    rng,
  );
}

function rollWeightedCategory<T extends string>(rates: Readonly<Record<T, number>>, rng: () => number): T {
  const draw = rng();
  let cumulative = 0;
  let fallback: T | null = null;

  for (const category of Object.keys(rates) as T[]) {
    fallback = category;
    cumulative += rates[category];
    if (draw < cumulative) return category;
  }

  if (fallback === null) throw new Error("[reward-flow] cannot roll from an empty category table");
  return fallback;
}

function getEncounterRewardRates(enemyType: "normal" | "elite", astralChanceBonus = 0) {
  const rates = ENCOUNTER_REWARD_RATES[enemyType];
  const basicToAstral = Math.min(Math.max(0, astralChanceBonus), rates.basic);
  return {
    ...rates,
    basic: rates.basic - basicToAstral,
    astral: rates.astral + basicToAstral,
  };
}

export function rollEncounterRewardCategory(enemyType: "normal" | "elite", rng: () => number): CombatRewardCategory {
  const rates = ENCOUNTER_REWARD_RATES[enemyType];
  return rollWeightedCategory(
    {
      card: rates.card,
      gear: rates.basic + rates.astral + rates.unique,
      boon: rates.boon,
      trinket: rates.trinket,
    },
    rng,
  );
}

export function rollBossRewardCategory(rng: () => number): "gear" | "trinket" {
  return rollWeightedCategory(
    {
      gear: BOSS_REWARD_RATES.astral + BOSS_REWARD_RATES.unique,
      trinket: BOSS_REWARD_RATES.trinket,
    },
    rng,
  );
}

export function rollCombatGearRewardRarity(
  enemyType: "normal" | "elite" | "boss",
  rng: () => number,
  astralChanceBonus = 0,
): GearRarity {
  const rates =
    enemyType === "boss" ? { basic: 0, ...BOSS_REWARD_RATES } : getEncounterRewardRates(enemyType, astralChanceBonus);
  const total = rates.basic + rates.astral + rates.unique;
  return rollWeightedCategory(
    {
      basic: rates.basic / total,
      astral: rates.astral / total,
      unique: rates.unique / total,
    },
    rng,
  );
}

export function createNextRewardState(rewardState: RewardState): CardRewardState {
  return {
    ...createEmptyRewardState(rewardState.destinations),
    selectedBossId: rewardState.selectedBossId,
    lastVictoryEnemyType: rewardState.lastVictoryEnemyType,
    lastVictoryContentSystem: rewardState.lastVictoryContentSystem,
  };
}

export function getRandomPotionCard(rng: () => number): BattleCard {
  const potion = pickRandom(getStandardPotionPool(), rng);
  if (!potion) {
    throw new Error("[reward-flow] getRandomPotionCard: no potion cards found in getStandardPotionPool()");
  }
  return potion;
}

export function getCompanionCardChoices(rng: () => number): BattleCard[] {
  const companions = cardLibrary.filter((c) => c.effects?.some((e) => e.kind === "summon-companion"));
  return sampleItems(companions, LABYRINTH_REWARD_CONFIG.companionCardChoices, rng);
}

function resolveRewardRoute(contentSystemType: ContentSystemId, currentEnemyType: string): FinalizeRewardRoute {
  if (contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
    return REWARD_ROUTES.LABYRINTH_MAP;
  }
  if (contentSystemType === CONTENT_SYSTEMS.WILDWOOD) {
    return REWARD_ROUTES.WILDWOOD_VICTORY;
  }
  return currentEnemyType === ENEMY_TYPES.BOSS ? REWARD_ROUTES.ACT_COMPLETE : REWARD_ROUTES.DESTINATION;
}

export function finalizeRewardState({ rewardState, companionRewardCards }: FinalizeRewardInput): FinalizeRewardResult {
  const selectedReward = resolveRewardChoice(rewardState);

  if (companionRewardCards && companionRewardCards.length > 0) {
    return {
      selectedReward,
      materials: rewardState.materials,
      nextRewardState: {
        ...createNextRewardState(rewardState),
        choices: companionRewardCards,
      },
      clearCompanionRewardCards: true,
      route: REWARD_ROUTES.COMPANION_REWARD,
    };
  }

  const contentSystemType = rewardState.lastVictoryContentSystem ?? CONTENT_SYSTEMS.CAMPAIGN;
  const currentEnemyType = rewardState.lastVictoryEnemyType ?? ENEMY_TYPES.NORMAL;
  const route = resolveRewardRoute(contentSystemType, currentEnemyType);

  return {
    selectedReward,
    materials: rewardState.materials,
    nextRewardState: createNextRewardState(rewardState),
    clearCompanionRewardCards: false,
    route,
  };
}

function createGearRewardState(
  rollRarity: () => GearRarity,
  rng: () => number,
  ownedUniqueIds: ReadonlySet<string>,
): GearRewardState {
  const rarities = Array.from({ length: REWARD_CARD_CHOICES }, rollRarity);
  const choices = generateGearRewardChoicesForRarities(rarities, rng, ownedUniqueIds);
  return {
    ...createEmptyRewardState(),
    rewardType: "gear",
    choices,
  };
}

function createFallbackGearRewardState(
  isBoss: boolean,
  rng: () => number,
  gearAstralChanceBonus: number,
  ownedUniqueIds: ReadonlySet<string>,
): GearRewardState {
  return createGearRewardState(() => rollGearRewardDropTier(rng, isBoss, gearAstralChanceBonus), rng, ownedUniqueIds);
}

export function createBossRewardState({
  gold,
  bossBonus,
  generousBonus,
  wealthyBonus,
  talentGoldPerCombat,
  materials,
  trinketIds,
  goldMultiplier = 1,
  rng,
  gearAstralChanceBonus = 0,
  ownedTrinketIds = [],
  ownedUniqueIds = new Set(),
}: BossRewardInput): GearRewardState | TrinketRewardState {
  const category = rollBossRewardCategory(rng);
  const reward =
    category === "trinket"
      ? (() => {
          const choices = samplePermanentTrinketRewardChoices(ownedTrinketIds, rng);
          return choices.length > 0
            ? {
                ...createEmptyRewardState(),
                rewardType: "trinket" as const,
                choices,
              }
            : createFallbackGearRewardState(true, rng, gearAstralChanceBonus, ownedUniqueIds);
        })()
      : createGearRewardState(() => rollCombatGearRewardRarity("boss", rng), rng, ownedUniqueIds);
  return {
    ...reward,
    gold: computeRewardGold({
      baseGold: gold,
      bonusGold: bossBonus,
      generousBonus,
      wealthyBonus,
      talentGoldPerCombat,
      trinketIds,
      goldMultiplier,
    }),
    materials,
  };
}

function createGearOrPermanentTrinketReward(
  ownedTrinketIds: readonly string[],
  rng: () => number,
  gearAstralChanceBonus: number,
  isBoss = false,
  ownedUniqueIds: ReadonlySet<string> = new Set(),
): GearRewardState | TrinketRewardState {
  const owned = new Set(ownedTrinketIds);
  const unowned = trinketLibrary.filter((entry) => !owned.has(entry.id));
  const trinketChance = isBoss
    ? GEAR_REWARD_PERMANENT_TRINKET_CHANCE.boss
    : GEAR_REWARD_PERMANENT_TRINKET_CHANCE.normal;
  if (unowned.length > 0 && rng() < trinketChance) {
    return {
      ...createEmptyRewardState(),
      rewardType: "trinket",
      choices: samplePermanentTrinketRewardChoices(ownedTrinketIds, rng),
    };
  }
  return {
    ...createEmptyRewardState(),
    rewardType: "gear",
    choices: generateGearRewardChoices(REWARD_CARD_CHOICES, rng, gearAstralChanceBonus, isBoss, ownedUniqueIds),
  };
}

function rollWildwoodRewardType(rng: () => number): "card" | "boon" | "gear" {
  const roll = Math.floor(rng() * 3);
  if (roll === 0) return "card";
  if (roll === 1) return "boon";
  return "gear";
}

export function computeWildwoodTrinketChance(): number {
  return GEAR_REWARD_PERMANENT_TRINKET_CHANCE.normal / 3;
}

export function createWildwoodRewardState(
  runDeck: BattleCard[],
  rng: () => number,
  gearAstralChanceBonus = 0,
  excludedBoonIds: string[] = [],
  ownedTrinketIds: string[] = [],
  ownedUniqueIds: ReadonlySet<string> = new Set(),
): CardRewardState | BoonRewardState | TrinketRewardState | GearRewardState {
  const rewardType = rollWildwoodRewardType(rng);
  if (rewardType === "gear") {
    return createGearOrPermanentTrinketReward(ownedTrinketIds, rng, gearAstralChanceBonus, false, ownedUniqueIds);
  }
  if (rewardType === "boon") {
    return {
      ...createEmptyRewardState(),
      rewardType: "boon",
      choices: sampleTrinketRewardChoices(excludedBoonIds, rng),
    };
  }
  return {
    ...createEmptyRewardState(),
    rewardType: "card",
    choices: selectRewardCards(runDeck, getOfferableCardPool(), REWARD_CARD_CHOICES, [], rng),
  };
}

export function createCombatRewardState({
  battleState,
  runDeck,
  gold,
  eliteBonus,
  generousBonus,
  wealthyBonus,
  talentGoldPerCombat,
  materials,
  destinations,
  trinketIds,
  goldMultiplier = 1,
  rng,
  excludedBoonIds = [],
  ownedTrinketIds = [],
  ownedUniqueIds = new Set(),
  gearAstralChanceBonus = 0,
}: CombatRewardInput): CardRewardState | BoonRewardState | TrinketRewardState | GearRewardState {
  const goldTotal = computeRewardGold({
    baseGold: gold,
    bonusGold: eliteBonus,
    generousBonus,
    wealthyBonus,
    talentGoldPerCombat,
    trinketIds,
    goldMultiplier,
  });

  const createCardReward = (): CardRewardState => ({
    ...createEmptyRewardState(destinations),
    rewardType: "card",
    choices: selectRewardCards(runDeck, getOfferableCardPool(), REWARD_CARD_CHOICES, [], rng),
    gold: goldTotal,
    materials,
  });

  const enemyType = battleState.currentEnemy.enemyType === ENEMY_TYPES.ELITE ? ENEMY_TYPES.ELITE : ENEMY_TYPES.NORMAL;
  const category = rollEncounterRewardCategory(enemyType, rng);

  switch (category) {
    case "card":
      return createCardReward();
    case "boon": {
      const choices = sampleTrinketRewardChoices(excludedBoonIds, rng);
      if (choices.length === 0) return createCardReward();
      return {
        ...createEmptyRewardState(destinations),
        rewardType: "boon",
        choices,
        gold: goldTotal,
        materials,
      };
    }
    case "trinket": {
      const choices = samplePermanentTrinketRewardChoices(ownedTrinketIds, rng);
      if (choices.length === 0) {
        return {
          ...createFallbackGearRewardState(false, rng, gearAstralChanceBonus, ownedUniqueIds),
          destinations,
          gold: goldTotal,
          materials,
        };
      }
      return {
        ...createEmptyRewardState(destinations),
        rewardType: "trinket",
        choices,
        gold: goldTotal,
        materials,
      };
    }
    case "gear":
      return {
        ...createGearRewardState(
          () => rollCombatGearRewardRarity(enemyType, rng, gearAstralChanceBonus),
          rng,
          ownedUniqueIds,
        ),
        destinations,
        gold: goldTotal,
        materials,
      };
  }
}
