// Combat and boss reward builders; re-exports reward state, gold, and routing modules.
import { getOfferableCardPool, trinketLibrary, type BattleCard } from "@/lib/game-data";
import {
  BOSS_TRINKET_REWARD_CHOICES,
  ELITE_TRINKET_REWARD_CHANCE,
  LABYRINTH_REWARD_CONFIG,
  REWARD_CARD_CHOICES,
  REWARD_TRINKET_CHANCE,
} from "@/lib/game-constants";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { BattleState } from "@/lib/battle";
import { sampleItems } from "../utils";
import { selectRewardCards } from "../reward-utils";
import { CONSTANTS, type Destination } from "../types";
import { computeRewardGold } from "./reward-gold";
import type { RewardState } from "./reward-state";

export type { RewardState } from "./reward-state";
export { createEmptyRewardState } from "./reward-state";

export {
  getActiveRewardModifiersForContentSystem,
  getGenerousGoldBonus,
  applyLabyrinthRewardMaterialModifiers,
  shouldForceTrinketReward,
  shouldGrantCompanionReward,
  shouldGrantAlchemistReward,
  getRandomPotionCard,
  getCompanionCardChoices,
  getVictoryGoldTotal,
  computeVictoryGoldResult,
} from "./reward-gold";

export { finalizeRewardState, executeRewardRouteTransition } from "./reward-routing";

type BossRewardInput = {
  gold: number;
  bossBonus: number;
  generousBonus: number;
  talentGoldPerCombat: number;
  materials: MaterialInventory;
  trinketIds: string[];
  goldMultiplier?: number;
};

type CombatRewardInput = {
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
  forceTrinket?: boolean;
};

export function createBossRewardState({
  gold,
  bossBonus,
  generousBonus,
  talentGoldPerCombat,
  materials,
  trinketIds,
  goldMultiplier = 1,
}: BossRewardInput): RewardState {
  return {
    rewardType: "trinket",
    choices: sampleItems(trinketLibrary, BOSS_TRINKET_REWARD_CHOICES),
    gold: computeRewardGold({
      baseGold: gold,
      bonusGold: bossBonus,
      generousBonus,
      talentGoldPerCombat,
      trinketIds,
      goldMultiplier,
    }),
    materials,
    selectedId: null,
    destinations: [],
    selectedBossId: null,
  };
}

function calculateCombatTrinketRewardOffer(
  battleState: BattleState,
  forceTrinket: boolean,
  rng: () => number = Math.random,
): boolean {
  if (forceTrinket) return true;
  const baseTrinketChance =
    battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE
      ? ELITE_TRINKET_REWARD_CHANCE
      : REWARD_TRINKET_CHANCE;
  const trinketHoarderBonus = battleState.currentEnemy.traits?.some((t) => t.id === "trinket-hoarder")
    ? LABYRINTH_REWARD_CONFIG.trinketHoarderRewardChanceBonus
    : 0;
  const trinketChanceBonus = battleState.talentEffects?.trinketChanceBonus ?? 0;
  return rng() < Math.min(baseTrinketChance + trinketHoarderBonus + trinketChanceBonus, 1);
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
  forceTrinket = false,
}: CombatRewardInput): RewardState {
  const offerTrinket = calculateCombatTrinketRewardOffer(battleState, forceTrinket);
  return {
    rewardType: offerTrinket ? "trinket" : "card",
    choices: offerTrinket
      ? sampleItems(trinketLibrary, REWARD_CARD_CHOICES)
      : selectRewardCards(runDeck, getOfferableCardPool(), REWARD_CARD_CHOICES),
    gold: computeRewardGold({
      baseGold: gold,
      bonusGold: eliteBonus,
      generousBonus,
      talentGoldPerCombat,
      trinketIds,
      goldMultiplier,
    }),
    materials,
    selectedId: null,
    destinations,
    selectedBossId: null,
  };
}
