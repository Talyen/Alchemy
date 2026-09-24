import type { LootProgress } from "@/lib/loot";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { ENEMY_TYPES, type BattleCard } from "@/lib/game-data";
import { REWARD_ROUTES, type Destination, type RewardRoute } from "@/lib/routing";
import {
  createEmptyRewardState,
  resolveRewardChoice,
  type CardRewardState,
  type ResolvedRewardChoice,
  type RewardState,
} from "@/lib/active-run-session";
import type { BattleSnapshot } from "@/lib/battle";
import type { MaterialInventory } from "@/lib/homestead/types";
import { createRewardOffer } from "./reward-offers";

export { getCompanionCardChoices, getRandomPotionCard } from "./reward-offers";

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

interface RewardPayoutInput {
  lootProgress: LootProgress;
  goldPayout: number;
  materials: MaterialInventory;
  rng: () => number;
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
  lootProgress: LootProgress;
  gearAstralChanceBonus?: number;
  excludedBoonIds?: readonly string[];
  ownedTrinketIds?: readonly string[];
  ownedUniqueIds?: ReadonlySet<string>;
}

export function createWildwoodRewardState({
  runDeck,
  rng,
  lootProgress,
  gearAstralChanceBonus = 0,
  excludedBoonIds = [],
  ownedTrinketIds = [],
  ownedUniqueIds = new Set(),
}: WildwoodRewardInput): RewardState {
  return {
    ...createEmptyRewardState(),
    ...createRewardOffer({
      source: "wildwood",
      runDeck,
      rng,
      lootProgress,
      gearAstralChanceBonus,
      excludedBoonIds,
      ownedTrinketIds,
      ownedUniqueIds,
    }),
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
