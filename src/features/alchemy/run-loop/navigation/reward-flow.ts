import {
  createEmptyRewardState,
  resolveRewardChoice,
  type CardRewardState,
  type ResolvedRewardChoice,
  type RewardState,
} from "@/lib/active-run-session";
import type { BattleSnapshot } from "@/lib/battle";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { ENEMY_TYPES, type BattleCard } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { LootProgress } from "@/lib/loot";
import { REWARD_ROUTES, type Destination, type RewardRoute } from "@/lib/routing";
import { createRewardOffer } from "./reward-offers";

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

interface RewardPayoutInput {
  lootProgress: LootProgress;
  goldPayout: number;
  materials: MaterialInventory;
  rng: () => number;
  createInstanceId?: (() => string) | undefined;
  excludedBoonIds?: string[];
  gearAstralChanceBonus?: number;
  ownedTrinketIds?: string[];
  ownedUniqueIds?: ReadonlySet<string>;
  rewardModifiers?: readonly EncounterRewardTraitId[];
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

export function createBossRewardState(input: BossRewardInput): RewardState {
  return {
    ...createEmptyRewardState(),
    ...createRewardOffer({ ...input, source: "boss" }),
    gold: input.goldPayout,
    materials: input.materials,
  };
}

export interface WildwoodRewardInput {
  runDeck: BattleCard[];
  rng: () => number;
  createInstanceId?: (() => string) | undefined;
  lootProgress: LootProgress;
  goldPayout?: number;
  materials?: MaterialInventory;
  gearAstralChanceBonus?: number;
  excludedBoonIds?: readonly string[];
  ownedTrinketIds?: readonly string[];
  ownedUniqueIds?: ReadonlySet<string>;
}

export function createWildwoodRewardState(input: WildwoodRewardInput): RewardState {
  const empty = createEmptyRewardState();
  const { goldPayout = 0 } = input;
  return {
    ...empty,
    // Wildwood's victory input may carry encounter traits for other reward
    // effects, but its offer is not a Labyrinth Hoard.
    ...createRewardOffer({ ...input, source: "wildwood", rewardModifiers: [] }),
    gold: goldPayout,
    materials: input.materials ?? empty.materials,
  };
}

export function createCombatRewardState(input: CombatRewardInput): RewardState {
  const source = input.battleState.currentEnemy.enemyType === ENEMY_TYPES.ELITE ? "elite" : "normal";
  return {
    ...createEmptyRewardState(),
    ...createRewardOffer({ ...input, source }),
    gold: input.goldPayout,
    materials: input.materials,
    destinations: input.destinations,
  };
}
