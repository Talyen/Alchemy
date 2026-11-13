import {
  createEmptyRewardState,
  resolveRewardChoice,
  type CardRewardState,
  type ResolvedRewardChoice,
  type RewardState,
} from "@/lib/active-run-session";
import type { BattleSnapshot } from "@/lib/battle";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { ENEMY_TYPES, type BattleCard } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { REWARD_ROUTES, type Destination, type RewardRoute } from "@/lib/routing";
import { createRewardOffer, type RewardOfferInput } from "./reward-offers";

export { getCompanionCardChoices, getRandomPotionCard } from "./reward-offers";

export interface FinalizeRewardInput {
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
}

export interface FinalizeRewardResult {
  selectedReward: ResolvedRewardChoice | null;
  materials: MaterialInventory;
  nextRewardState: CardRewardState;
  clearCompanionRewardCards: boolean;
  route: RewardRoute;
}

interface RewardPayoutInput extends Omit<RewardOfferInput, "source"> {
  goldPayout: number;
  materials: MaterialInventory;
}

export type BossRewardInput = RewardPayoutInput;

export interface CombatRewardInput extends RewardPayoutInput {
  battleState: BattleSnapshot;
  runDeck: BattleCard[];
  destinations: Destination[];
}

export function createNextRewardState(rewardState: RewardState): CardRewardState {
  return {
    ...createEmptyRewardState(rewardState.destinations),
    selectedBossId: rewardState.selectedBossId,
    lastVictoryEnemyType: rewardState.lastVictoryEnemyType,
    lastVictoryContentSystem: rewardState.lastVictoryContentSystem,
  };
}

function resolveRewardRoute(contentSystemType: ContentSystemId, currentEnemyType: string): RewardRoute {
  if (contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
    return REWARD_ROUTES.LABYRINTH_MAP;
  }
  if (contentSystemType === CONTENT_SYSTEMS.WILDWOOD) {
    return REWARD_ROUTES.WILDWOOD_VICTORY;
  }
  return currentEnemyType === ENEMY_TYPES.BOSS ? REWARD_ROUTES.ACT_COMPLETE : REWARD_ROUTES.DESTINATION;
}

export function finalizeRewardState({ rewardState, companionRewardCards }: FinalizeRewardInput): FinalizeRewardResult {
  const hasCompanionReward = Boolean(companionRewardCards?.length);
  const nextRewardState = createNextRewardState(rewardState);
  if (companionRewardCards?.length) nextRewardState.choices = companionRewardCards;
  return {
    selectedReward: resolveRewardChoice(rewardState),
    materials: rewardState.materials,
    nextRewardState,
    clearCompanionRewardCards: hasCompanionReward,
    route: hasCompanionReward
      ? REWARD_ROUTES.COMPANION_REWARD
      : resolveRewardRoute(
          rewardState.lastVictoryContentSystem ?? CONTENT_SYSTEMS.CAMPAIGN,
          rewardState.lastVictoryEnemyType ?? ENEMY_TYPES.NORMAL,
        ),
  };
}

function createRewardState(
  input: RewardOfferInput & { goldPayout?: number; materials?: MaterialInventory },
): RewardState {
  const empty = createEmptyRewardState();
  return {
    ...empty,
    ...createRewardOffer(input),
    gold: input.goldPayout ?? 0,
    materials: input.materials ?? empty.materials,
  };
}

export function createBossRewardState(input: BossRewardInput): RewardState {
  return createRewardState({ ...input, source: "boss" });
}

export interface WildwoodRewardInput extends Omit<RewardOfferInput, "source" | "rewardModifiers"> {
  runDeck: BattleCard[];
  goldPayout?: number;
  materials?: MaterialInventory;
}

export function createWildwoodRewardState(input: WildwoodRewardInput): RewardState {
  // Encounter traits can arrive through a wider victory input, but Wildwood never offers a Labyrinth Hoard.
  return createRewardState({ ...input, source: "wildwood", rewardModifiers: [] });
}

export function createCombatRewardState(input: CombatRewardInput): RewardState {
  const source = input.battleState.currentEnemy.enemyType === ENEMY_TYPES.ELITE ? "elite" : "normal";
  return { ...createRewardState({ ...input, source }), destinations: input.destinations };
}
