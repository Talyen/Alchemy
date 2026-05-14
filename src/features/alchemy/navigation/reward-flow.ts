// Reward-state construction helpers for battle victory and routing.
// Depends on game data, reward selectors, trinket manifest rules, and material inventory types.
import { cardLibrary, trinketLibrary, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { BOSS_TRINKET_REWARD_CHOICES, ELITE_TRINKET_REWARD_CHANCE, REWARD_CARD_CHOICES } from "@/lib/game-constants";
import { computeTrinketManifest } from "@/lib/trinkets";
import { emptyInventory, type MaterialInventory } from "@/lib/homestead/types";
import type { BattleState } from "@/lib/battle";
import { selectRewardCards, selectRewardTrinkets, REWARD_TRINKET_CHANCE } from "../reward-utils";
import type { Destination } from "../types";

export type RewardState = {
  choices: (BattleCard | TrinketEntry)[];
  gold: number;
  materials: MaterialInventory;
  selectedId: string | null;
  destinations: Destination[];
  rewardType: "card" | "trinket";
};

type BossRewardInput = {
  gold: number;
  bossBonus: number;
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
  talentGoldPerCombat: number;
  materials: MaterialInventory;
  destinations: Destination[];
  trinketIds: string[];
  goldMultiplier?: number;
};

// Empty reward state is reused by initialization, reward cleanup, and full run reset.
export function createEmptyRewardState(destinations: Destination[] = []): RewardState {
  return { choices: [], gold: 0, materials: emptyInventory(), selectedId: null, destinations, rewardType: "card" };
}

// Bosses always offer trinkets and route into act-complete handling rather than another node.
export function createBossRewardState({ gold, bossBonus, talentGoldPerCombat, materials, trinketIds, goldMultiplier = 1 }: BossRewardInput): RewardState {
  const trinketGoldBonus = computeTrinketManifest(trinketIds).smugglersMapGoldBonus;
  return {
    rewardType: "trinket",
    choices: selectRewardTrinkets(trinketLibrary, BOSS_TRINKET_REWARD_CHOICES),
    gold: Math.floor((gold + bossBonus + talentGoldPerCombat + trinketGoldBonus) * goldMultiplier),
    materials,
    selectedId: null,
    destinations: [],
  };
}

// Combat rewards can be cards or trinkets. Destination choices are supplied by the hook
// because they depend on post-victory run HP/gold and act progression.
export function createCombatRewardState({ battleState, runDeck, gold, eliteBonus, talentGoldPerCombat, materials, destinations, trinketIds, goldMultiplier = 1 }: CombatRewardInput): RewardState {
  const trinketChance = battleState.currentEnemy.enemyType === "elite" ? ELITE_TRINKET_REWARD_CHANCE : REWARD_TRINKET_CHANCE;
  const offerTrinket = Math.random() < trinketChance;
  const trinketGoldBonus = computeTrinketManifest(trinketIds).smugglersMapGoldBonus;
  return {
    rewardType: offerTrinket ? "trinket" : "card",
    choices: offerTrinket ? selectRewardTrinkets(trinketLibrary, REWARD_CARD_CHOICES) : selectRewardCards(runDeck, cardLibrary, REWARD_CARD_CHOICES),
    gold: Math.floor((gold + eliteBonus + talentGoldPerCombat + trinketGoldBonus) * goldMultiplier),
    materials,
    selectedId: null,
    destinations,
  };
}

// Computes the total post-victory gold with all run/talent/trinket modifiers applied.
export function getVictoryGoldTotal(battleState: BattleState, runTrinkets: string[], gold: number, eliteBonus: number, bossBonus: number, talentGoldPerCombat: number): number {
  const trinketGoldBonus = computeTrinketManifest(runTrinkets).smugglersMapGoldBonus;
  return battleState.gold + gold + eliteBonus + bossBonus + talentGoldPerCombat + trinketGoldBonus;
}
