// Reward state, gold math, routing, and combat/boss reward builders.
import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { cardLibrary, selectRewardCards, trinketLibrary, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { LABYRINTH_REWARD_CONFIG, REWARD_CARD_CHOICES } from "@/lib/game-constants";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { shuffle } from "@/lib/utils";
import { CONSTANTS } from "../../shared/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { sampleItems } from "../../shared/utils/random";
import { generateGearRewardChoices, type GearInstance } from "@/lib/gear";
import {
  createEmptyRewardState,
  type CardRewardState,
  type GearRewardState,
  type RewardState,
  type TrinketRewardState,
} from "@/lib/active-run-session/reward-types";

export type {
  CardRewardState,
  GearRewardState,
  RewardState,
  TrinketRewardState,
} from "@/lib/active-run-session/reward-types";
export { createEmptyRewardState } from "@/lib/active-run-session/reward-types";

export {
  shouldGrantCompanionReward,
  shouldGrantAlchemistReward,
  getActiveRewardModifiersForContentSystem,
  getGenerousGoldBonus,
  applyLabyrinthRewardMaterialModifiers,
  computeVictoryGold,
} from "./reward-math";

export type { VictoryGoldInput, VictoryGoldResult, RewardGoldInput } from "./reward-math";

import { computeRewardGold } from "./reward-math";
import type {
  BossRewardInput,
  CombatRewardInput,
  FinalizeRewardInput,
  FinalizeRewardResult,
  FinalizeRewardRoute,
  RewardRouteDeps,
} from "./reward-flow-types";
export type {
  FinalizeRewardInput,
  FinalizeRewardResult,
  FinalizeRewardRoute,
  RewardRouteDeps,
} from "./reward-flow-types";

export function getRewardChoiceId(choice: BattleCard | TrinketEntry | GearInstance): string {
  return choice && typeof choice === "object" && "instanceId" in choice ? choice.instanceId : choice.id;
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
  const potionCards = getStandardPotionPool();
  const index = Math.floor(rng() * potionCards.length);
  if (process.env.NODE_ENV !== "production" && potionCards.length === 0) {
    console.error("[reward-flow] getRandomPotionCard: no potion cards found in getStandardPotionPool()");
  }
  return potionCards[index]!;
}

export function getCompanionCardChoices(rng: () => number): BattleCard[] {
  const companions = cardLibrary.filter((c) => c.effects?.some((e) => e.kind === "summon-companion"));
  return shuffle(companions, rng).slice(0, LABYRINTH_REWARD_CONFIG.companionCardChoices);
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
        choices: companionRewardCards,
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: rewardState.destinations,
        rewardType: "card",
        selectedBossId: rewardState.selectedBossId,
        lastVictoryEnemyType: rewardState.lastVictoryEnemyType,
        lastVictoryContentSystem: rewardState.lastVictoryContentSystem,
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

export function executeRewardRouteTransition(
  route: FinalizeRewardResult["route"],
  materials: MaterialInventory,
  nextRewardState: CardRewardState,
  clearCompanion: boolean,
  deps: RewardRouteDeps,
) {
  const setReward = () => {
    deps.setRewardState(nextRewardState);
    if (clearCompanion) deps.setCompanionRewardCards(null);
  };
  switch (route) {
    case CONSTANTS.REWARD_ROUTES.COMPANION_REWARD:
      deps.navigateTo(CONSTANTS.SCREENS.REWARDS, setReward);
      break;
    case CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY:
      deps.completeRunVictory(materials, setReward);
      break;
    case CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY:
      deps.completeRunVictory(materials, setReward);
      break;
    case CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP:
      deps.labyrinthClearNode();
      deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP, setReward);
      break;
    case CONSTANTS.REWARD_ROUTES.ACT_COMPLETE:
      deps.handleActComplete(materials);
      break;
    case CONSTANTS.REWARD_ROUTES.DESTINATION:
      deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, setReward);
      break;
  }
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
}: BossRewardInput): GearRewardState {
  return {
    ...createEmptyRewardState(),
    rewardType: "gear",
    choices: generateGearRewardChoices(REWARD_CARD_CHOICES, rng, gearAstralChanceBonus),
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

function rollWildwoodRewardType(rng: () => number): "card" | "trinket" | "gear" {
  const roll = Math.floor(rng() * 3);
  if (roll === 0) return "card";
  if (roll === 1) return "trinket";
  return "gear";
}

export function createWildwoodRewardState(
  runDeck: BattleCard[],
  rng: () => number,
  gearAstralChanceBonus = 0,
): CardRewardState | TrinketRewardState | GearRewardState {
  const rewardType = rollWildwoodRewardType(rng);
  if (rewardType === "gear") {
    return {
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: generateGearRewardChoices(REWARD_CARD_CHOICES, rng, gearAstralChanceBonus),
    };
  }
  if (rewardType === "trinket") {
    return {
      ...createEmptyRewardState(),
      rewardType: "trinket",
      choices: sampleItems(trinketLibrary, REWARD_CARD_CHOICES, rng),
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
}: CombatRewardInput): CardRewardState | TrinketRewardState {
  const goldTotal = computeRewardGold({
    baseGold: gold,
    bonusGold: eliteBonus,
    generousBonus,
    talentGoldPerCombat,
    trinketIds,
    goldMultiplier,
  });
  if (battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE) {
    return {
      ...createEmptyRewardState(destinations),
      rewardType: "trinket",
      choices: sampleItems(trinketLibrary, REWARD_CARD_CHOICES, rng),
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
