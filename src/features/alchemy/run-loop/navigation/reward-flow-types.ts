import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { CardRewardState, ResolvedRewardChoice, RewardState } from "@/lib/active-run-session";
import type { Destination, RewardRoute } from "@/lib/routing";

export type FinalizeRewardRoute = RewardRoute;

export interface FinalizeRewardInput {
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
}

export interface FinalizeRewardResult {
  selectedReward: ResolvedRewardChoice | null;
  materials: MaterialInventory;
  nextRewardState: CardRewardState;
  clearCompanionRewardCards: boolean;
  route: FinalizeRewardRoute;
}

export interface BossRewardInput {
  gold: number;
  bossBonus: number;
  generousBonus: number;
  talentGoldPerCombat: number;
  materials: MaterialInventory;
  trinketIds: string[];
  goldMultiplier?: number;
  rng: () => number;
  gearAstralChanceBonus?: number;
  ownedTrinketIds?: string[];
  ownedUniqueIds?: ReadonlySet<string>;
}

export interface CombatRewardInput {
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
  rng: () => number;
  excludedBoonIds?: string[];
}
