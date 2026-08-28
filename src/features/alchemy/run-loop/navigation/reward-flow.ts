import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import {
  GEAR_REWARD_PERMANENT_TRINKET_CHANCE,
  LABYRINTH_REWARD_CONFIG,
  REWARD_CARD_CHOICES,
} from "@/lib/game-constants";
import { pickRandom, sampleItems } from "@/lib/utils";
import { generateGearRewardChoices } from "@/lib/gear";
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
  applyLabyrinthRewardMaterialModifiers,
  computeVictoryGold,
} from "./reward-math";

import { computeRewardGold } from "./reward-math";
import type {
  BossRewardInput,
  CombatRewardInput,
  FinalizeRewardInput,
  FinalizeRewardResult,
  FinalizeRewardRoute,
} from "./reward-flow-types";
import { REWARD_ROUTES } from "@/lib/routing";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { ENEMY_TYPES, cardLibrary, selectRewardCards, trinketLibrary, type BattleCard } from "@/lib/game-data";

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

export function createBossRewardState({
  gold,
  bossBonus,
  generousBonus,
  talentGoldPerCombat,
  materials,
  trinketIds,
  goldMultiplier = 1,
  rng,
  gearAstralChanceBonus = 0,
  ownedTrinketIds = [],
  ownedUniqueIds = new Set(),
}: BossRewardInput): GearRewardState | TrinketRewardState {
  const reward = createGearOrPermanentTrinketReward(ownedTrinketIds, rng, gearAstralChanceBonus, true, ownedUniqueIds);
  return {
    ...reward,
    gold: computeRewardGold({
      baseGold: gold,
      bonusGold: bossBonus,
      generousBonus,
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
      choices: sampleItems(unowned, REWARD_CARD_CHOICES, rng),
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
    const excluded = new Set(excludedBoonIds);
    return {
      ...createEmptyRewardState(),
      rewardType: "boon",
      choices: sampleItems(
        trinketLibrary.filter((entry) => !excluded.has(entry.id)),
        REWARD_CARD_CHOICES,
        rng,
      ),
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
  talentGoldPerCombat,
  materials,
  destinations,
  trinketIds,
  goldMultiplier = 1,
  rng,
  excludedBoonIds = [],
}: CombatRewardInput): CardRewardState | BoonRewardState {
  const goldTotal = computeRewardGold({
    baseGold: gold,
    bonusGold: eliteBonus,
    generousBonus,
    talentGoldPerCombat,
    trinketIds,
    goldMultiplier,
  });
  if (battleState.currentEnemy.enemyType === ENEMY_TYPES.ELITE) {
    const excluded = new Set(excludedBoonIds);
    return {
      ...createEmptyRewardState(destinations),
      rewardType: "boon",
      choices: sampleItems(
        trinketLibrary.filter((entry) => !excluded.has(entry.id)),
        REWARD_CARD_CHOICES,
        rng,
      ),
      gold: goldTotal,
      materials,
    };
  }
  return {
    ...createEmptyRewardState(destinations),
    rewardType: "card",
    choices: selectRewardCards(runDeck, getOfferableCardPool(), REWARD_CARD_CHOICES, [], rng),
    gold: goldTotal,
    materials,
  };
}
