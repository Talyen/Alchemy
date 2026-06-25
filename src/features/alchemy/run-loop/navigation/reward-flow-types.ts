import type { BattleState } from "@/lib/battle";
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GearInstance } from "@/lib/gear";
import type { CONSTANTS, Destination, Screen } from "../../shared/types";
import type { CardRewardState, RewardState } from "@/lib/active-run-session/reward-types";

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

export interface RewardRouteTransitionHandlers {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  completeRunVictory: (materials: MaterialInventory, onRenderedScreenCommit?: () => void) => void;
  handleActComplete: (materials: MaterialInventory) => void;
  onLabyrinthClearNode: () => void;
  setCompanionRewardCards: (cards: BattleCard[] | null) => void;
  setRewardState: (state: RewardState) => void;
}

export interface BossRewardInput {
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
  rng?: () => number;
}
