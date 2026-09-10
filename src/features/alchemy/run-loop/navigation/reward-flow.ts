import { resolveLootWeights, rollLootGroup, type LootProgress, type LootSource } from "@/lib/loot";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import {
  ENEMY_TYPES,
  cardLibrary,
  getCardKeywords,
  selectRewardCards,
  trinketLibrary,
  type BattleCard,
} from "@/lib/game-data";
import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { LABYRINTH_REWARD_CONFIG, REWARD_CARD_CHOICES } from "@/lib/game-constants";
import { pickRandom, sampleItems } from "@/lib/rng";
import { REWARD_ROUTES, type Destination, type RewardRoute } from "@/lib/routing";
import { generateLootGearChoices, getGearLootAvailability } from "@/lib/gear";
import {
  createEmptyRewardState,
  resolveRewardChoice,
  type CardRewardState,
  type ResolvedRewardChoice,
  type RewardState,
} from "@/lib/active-run-session";
import type { BattleState } from "@/lib/battle";
import type { MaterialInventory } from "@/lib/homestead/types";
import { computeRewardGold } from "./reward-math";

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
  lootProgress: LootProgress;
  gold: number;
  bossBonus: number;
  generousBonus: number;
  wealthyBonus: number;
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
  lootProgress: LootProgress;
  battleState: BattleState;
  runDeck: BattleCard[];
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  wealthyBonus: number;
  talentGoldPerCombat: number;
  materials: MaterialInventory;
  destinations: Destination[];
  trinketIds: string[];
  goldMultiplier?: number;
  rng: () => number;
  excludedBoonIds?: string[];
  ownedTrinketIds?: string[];
  ownedUniqueIds?: ReadonlySet<string>;
  gearAstralChanceBonus?: number;
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
  const potion = pickRandom(getStandardPotionPool(), rng);
  if (!potion) {
    throw new Error("[reward-flow] getRandomPotionCard: no potion cards found in getStandardPotionPool()");
  }
  return potion;
}

export function getCompanionCardChoices(
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = ["companion"],
): BattleCard[] {
  const theme = modifiers.includes("fletched")
    ? "archery"
    : modifiers.includes("wishkeeper")
      ? "wish"
      : modifiers.includes("kindred-spoils")
        ? "nature"
        : "companion";
  const companions =
    theme === "companion"
      ? cardLibrary.filter((c) => c.effects?.some((e) => e.kind === "summon-companion"))
      : getOfferableCardPool().filter((card) => getCardKeywords(card).includes(theme));
  return sampleItems(companions, LABYRINTH_REWARD_CONFIG.companionCardChoices, rng);
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

function createLootRewardState({
  source,
  lootProgress,
  rng,
  runDeck = [],
  gearAstralChanceBonus = 0,
  ownedTrinketIds = [],
  excludedBoonIds = [],
  ownedUniqueIds = new Set(),
}: {
  source: LootSource;
  lootProgress: LootProgress;
  rng: () => number;
  runDeck?: BattleCard[];
  gearAstralChanceBonus?: number;
  ownedTrinketIds?: readonly string[];
  excludedBoonIds?: readonly string[];
  ownedUniqueIds?: ReadonlySet<string>;
}): RewardState {
  const cards = getOfferableCardPool();
  const boons = trinketLibrary.filter((entry) => !excludedBoonIds.includes(entry.id));
  const trinkets = trinketLibrary.filter((entry) => !ownedTrinketIds.includes(entry.id));
  const weights = resolveLootWeights({
    source,
    progress: lootProgress,
    astralChanceBonus: gearAstralChanceBonus,
    available: {
      ...getGearLootAvailability(ownedUniqueIds),
      card: cards.length > 0,
      boon: boons.length > 0,
      trinket: trinkets.length > 0,
    },
  });
  const category = rollLootGroup(weights, rng);
  switch (category) {
    case "gear":
      return {
        ...createEmptyRewardState(),
        rewardType: "gear",
        choices: generateLootGearChoices(REWARD_CARD_CHOICES, rng, weights, ownedUniqueIds),
      };
    case "trinket":
      return {
        ...createEmptyRewardState(),
        rewardType: "trinket",
        choices: sampleItems(trinkets, REWARD_CARD_CHOICES, rng),
      };
    case "boon":
      return { ...createEmptyRewardState(), rewardType: "boon", choices: sampleItems(boons, REWARD_CARD_CHOICES, rng) };
    case "card":
      return { ...createEmptyRewardState(), choices: selectRewardCards(runDeck, cards, REWARD_CARD_CHOICES, [], rng) };
  }
}

export function createBossRewardState(input: BossRewardInput): RewardState {
  return {
    ...createLootRewardState({ ...input, source: "boss" }),
    gold: computeRewardGold({
      baseGold: input.gold,
      bonusGold: input.bossBonus,
      generousBonus: input.generousBonus,
      wealthyBonus: input.wealthyBonus,
      talentGoldPerCombat: input.talentGoldPerCombat,
      trinketIds: input.trinketIds,
      goldMultiplier: input.goldMultiplier ?? 1,
    }),
    materials: input.materials,
  };
}

export function createWildwoodRewardState(
  runDeck: BattleCard[],
  rng: () => number,
  lootProgress: LootProgress,
  gearAstralChanceBonus = 0,
  excludedBoonIds: string[] = [],
  ownedTrinketIds: string[] = [],
  ownedUniqueIds: ReadonlySet<string> = new Set(),
): RewardState {
  return createLootRewardState({
    source: "wildwood",
    runDeck,
    rng,
    lootProgress,
    gearAstralChanceBonus,
    excludedBoonIds,
    ownedTrinketIds,
    ownedUniqueIds,
  });
}

export function createCombatRewardState(input: CombatRewardInput): RewardState {
  const source = input.battleState.currentEnemy.enemyType === ENEMY_TYPES.ELITE ? "elite" : "normal";
  return {
    ...createLootRewardState({ ...input, source }),
    gold: computeRewardGold({
      baseGold: input.gold,
      bonusGold: input.eliteBonus,
      generousBonus: input.generousBonus,
      wealthyBonus: input.wealthyBonus,
      talentGoldPerCombat: input.talentGoldPerCombat,
      trinketIds: input.trinketIds,
      goldMultiplier: input.goldMultiplier ?? 1,
    }),
    materials: input.materials,
    destinations: input.destinations,
  };
}
