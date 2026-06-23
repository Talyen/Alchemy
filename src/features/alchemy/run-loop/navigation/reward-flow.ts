// Reward state, gold math, routing, and combat/boss reward builders.
import {
  cardLibrary,
  getOfferableCardPool,
  getStandardPotionPool,
  selectRewardCards,
  trinketLibrary,
  type BattleCard,
  type TrinketEntry,
} from "@/lib/game-data";
import { LABYRINTH_REWARD_CONFIG, REWARD_CARD_CHOICES } from "@/lib/game-constants";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { BattleState } from "@/lib/battle";
import { shuffle } from "@/lib/utils";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { sampleItems } from "../../shared/utils/random";
import {
  resolveCardChoices,
  resolveGearChoices,
  resolveTrinketChoices,
} from "@/lib/active-run-session/pending-reward-persistence";
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

export function getRandomPotionCard(rng: () => number = Math.random): BattleCard {
  const potionCards = getStandardPotionPool();
  const index = Math.floor(rng() * potionCards.length);
  if (process.env.NODE_ENV !== "production" && potionCards.length === 0) {
    console.error("[reward-flow] getRandomPotionCard: no potion cards found in getStandardPotionPool()");
  }
  return potionCards[index]!;
}

export function getCompanionCardChoices(rng: () => number = Math.random): BattleCard[] {
  const companions = cardLibrary.filter((c) => c.effects?.some((e) => e.kind === "summon-companion"));
  return shuffle(companions, rng).slice(0, LABYRINTH_REWARD_CONFIG.companionCardChoices);
}

export type FinalizeRewardRoute = (typeof CONSTANTS.REWARD_ROUTES)[keyof typeof CONSTANTS.REWARD_ROUTES];

export interface FinalizeRewardInput {
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
}

export interface FinalizeRewardResult {
  selectedChoice: BattleCard | TrinketEntry | GearInstance | null;
  selectedRewardType: RewardState["rewardType"];
  materials: MaterialInventory;
  nextRewardState: CardRewardState;
  clearCompanionRewardCards: boolean;
  route: FinalizeRewardRoute;
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

export interface RewardRouteTransitionHandlers {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  completeRunVictory: (materials: MaterialInventory, onRenderedScreenCommit?: () => void) => void;
  handleActComplete: (materials: MaterialInventory) => void;
  onLabyrinthClearNode: () => void;
  setCompanionRewardCards: (cards: BattleCard[] | null) => void;
  setRewardState: (state: RewardState) => void;
}

export function executeRewardRouteTransition(
  route: FinalizeRewardResult["route"],
  materials: MaterialInventory,
  nextRewardState: CardRewardState,
  clearCompanion: boolean,
  handlers: RewardRouteTransitionHandlers,
) {
  const setReward = () => handlers.setRewardState(nextRewardState);
  switch (route) {
    case CONSTANTS.REWARD_ROUTES.COMPANION_REWARD:
      if (clearCompanion) handlers.setCompanionRewardCards(null);
      handlers.navigateTo(CONSTANTS.SCREENS.REWARDS, setReward);
      break;
    case CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY:
      handlers.completeRunVictory(materials, setReward);
      break;
    case CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY:
      handlers.completeRunVictory(materials, setReward);
      break;
    case CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP:
      handlers.onLabyrinthClearNode();
      handlers.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP, setReward);
      break;
    case CONSTANTS.REWARD_ROUTES.ACT_COMPLETE:
      handlers.handleActComplete(materials);
      break;
    case CONSTANTS.REWARD_ROUTES.DESTINATION:
      handlers.navigateTo(CONSTANTS.SCREENS.DESTINATION, setReward);
      break;
  }
}

interface BossRewardInput {
  gold: number;
  bossBonus: number;
  generousBonus: number;
  talentGoldPerCombat: number;
  materials: MaterialInventory;
  trinketIds: string[];
  goldMultiplier?: number;
  rng?: () => number;
  gearAstralChanceBonus?: number;
}

interface CombatRewardInput {
  battleState: BattleState;
  runDeck: BattleCard[];
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  talentGoldPerCombat: number;
  materials: MaterialInventory;
  destinations: Destination[];
  trinketIds: string[];
  goldMultiplier?: number;
  rng?: () => number;
}

export function createBossRewardState({
  gold,
  bossBonus,
  generousBonus,
  talentGoldPerCombat,
  materials,
  trinketIds,
  goldMultiplier = 1,
  rng = Math.random,
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
  rng: () => number = Math.random,
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

export function restoreWildwoodRewardState(
  rewardType: "card" | "trinket" | "gear",
  choiceIds: string[],
  selectedId: string | null,
  gearChoices: GearInstance[] = [],
): CardRewardState | TrinketRewardState | GearRewardState {
  if (rewardType === "gear") {
    const choices = resolveGearChoices(gearChoices) ?? [];
    return { ...createEmptyRewardState(), rewardType: "gear", choices, selectedId };
  }
  if (rewardType === "card") {
    const choices = resolveCardChoices(choiceIds) ?? [];
    return { ...createEmptyRewardState(), rewardType: "card", choices, selectedId };
  }
  const choices = resolveTrinketChoices(choiceIds) ?? [];
  return { ...createEmptyRewardState(), rewardType: "trinket", choices, selectedId };
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
  rng = Math.random,
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
