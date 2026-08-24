// Reward state, gold math, and combat/boss reward builders.
import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { cardLibrary, selectRewardCards, trinketLibrary, type BattleCard } from "@/lib/game-data";
import { LABYRINTH_REWARD_CONFIG, REWARD_CARD_CHOICES } from "@/lib/game-constants";
import { pickRandom, sampleItems } from "@/lib/utils";
import { CONSTANTS } from "../../shared/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { generateGearRewardChoices } from "@/lib/gear";
import {
  createEmptyRewardState,
  getRewardChoiceId,
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
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
    return currentEnemyType === CONSTANTS.ENEMY_TYPES.BOSS
      ? CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY
      : CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP;
  }
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    return CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY;
  }
  return currentEnemyType === CONSTANTS.ENEMY_TYPES.BOSS
    ? CONSTANTS.REWARD_ROUTES.ACT_COMPLETE
    : CONSTANTS.REWARD_ROUTES.DESTINATION;
}

export function finalizeRewardState({ rewardState, companionRewardCards }: FinalizeRewardInput): FinalizeRewardResult {
  const selectedChoice = rewardState.selectedId
    ? (rewardState.choices.find((choice) => getRewardChoiceId(choice) === rewardState.selectedId) ?? null)
    : null;

  if (companionRewardCards && companionRewardCards.length > 0) {
    return {
      selectedChoice,
      selectedRewardType: rewardState.rewardType,
      materials: rewardState.materials,
      nextRewardState: {
        ...createNextRewardState(rewardState),
        choices: companionRewardCards,
      },
      clearCompanionRewardCards: true,
      route: CONSTANTS.REWARD_ROUTES.COMPANION_REWARD,
    };
  }

  const contentSystemType = rewardState.lastVictoryContentSystem ?? CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN;
  const currentEnemyType = rewardState.lastVictoryEnemyType ?? CONSTANTS.ENEMY_TYPES.NORMAL;
  const route = resolveRewardRoute(contentSystemType, currentEnemyType);

  return {
    selectedChoice,
    selectedRewardType: rewardState.rewardType,
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
}: BossRewardInput): GearRewardState | TrinketRewardState {
  const reward = createGearOrPermanentTrinketReward(ownedTrinketIds, rng, gearAstralChanceBonus);
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
): GearRewardState | TrinketRewardState {
  const owned = new Set(ownedTrinketIds);
  const unowned = trinketLibrary.filter((entry) => !owned.has(entry.id));
  if (unowned.length > 0 && rng() < 1 / 3) {
    return {
      ...createEmptyRewardState(),
      rewardType: "trinket",
      choices: sampleItems(unowned, REWARD_CARD_CHOICES, rng),
    };
  }
  return {
    ...createEmptyRewardState(),
    rewardType: "gear",
    choices: generateGearRewardChoices(REWARD_CARD_CHOICES, rng, gearAstralChanceBonus),
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
): CardRewardState | BoonRewardState | TrinketRewardState | GearRewardState {
  const rewardType = rollWildwoodRewardType(rng);
  if (rewardType === "gear") {
    return createGearOrPermanentTrinketReward(ownedTrinketIds, rng, gearAstralChanceBonus);
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
  if (battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE) {
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
