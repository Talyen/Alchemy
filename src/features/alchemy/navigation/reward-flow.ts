// Reward-state construction helpers for battle victory and routing.
// Depends on: game data, game constants, trinket manifests, reward utilities, and content types.
// Depended on by: useRunNavigation for generating and processing combat/boss victory rewards.
import { cardLibrary, trinketLibrary, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import {
  BOSS_TRINKET_REWARD_CHOICES,
  ELITE_TRINKET_REWARD_CHANCE,
  LABYRINTH_REWARD_CONFIG,
  MIXED_POTION_CARD_ID,
  REWARD_CARD_CHOICES,
} from "@/lib/game-constants";
import { computeTrinketManifest } from "@/lib/trinkets";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { BattleState } from "@/lib/battle";
import { selectRewardCards, selectRewardTrinkets, REWARD_TRINKET_CHANCE } from "../reward-utils";
import { CONSTANTS, type Destination } from "../types";
import type { ContentSystemId, LabyrinthModifierKind } from "@/lib/content-systems/types";

export type RewardState = {
  choices: (BattleCard | TrinketEntry)[];
  gold: number;
  materials: MaterialInventory;
  selectedId: string | null;
  destinations: Destination[];
  rewardType: "card" | "trinket";
  selectedBossId: string | null;
};

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

export type VictoryGoldInput = {
  battleState: Pick<BattleState, "gold">;
  runGold: number;
  runTrinkets: string[];
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  bossBonus: number;
  talentGoldPerCombat: number;
  goldMultiplier: number;
};

export type VictoryGoldTotalInput = Omit<VictoryGoldInput, "runGold" | "goldMultiplier">;

export type VictoryGoldResult = {
  unmultipliedTotal: number;
  earnedBeforeMultiplier: number;
  persistedRunGold: number;
};

export type FinalizeRewardRoute =
  | "companion-reward"
  | "labyrinth-victory"
  | "labyrinth-map"
  | "wildwood-victory"
  | "act-complete"
  | "destination";

export type FinalizeRewardInput = {
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
  contentSystemType: ContentSystemId;
  currentEnemyType: string;
  grantAlchemistReward: boolean;
};

export type FinalizeRewardResult = {
  selectedChoice: BattleCard | TrinketEntry | null;
  selectedRewardType: RewardState["rewardType"];
  materials: MaterialInventory;
  grantAlchemistReward: boolean;
  nextRewardState: RewardState;
  clearCompanionRewardCards: boolean;
  route: FinalizeRewardRoute;
};

// Checks if a reward modifier kind is active in the given array.
export function hasRewardModifier(modifiers: LabyrinthModifierKind[], kind: LabyrinthModifierKind): boolean {
  return modifiers.includes(kind);
}

// Labyrinth reward modifiers are node-scoped and must not leak into other modes.
export function getActiveRewardModifiersForContentSystem(
  contentSystemType: ContentSystemId,
  modifiers: LabyrinthModifierKind[],
): LabyrinthModifierKind[] {
  return contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH ? modifiers : [];
}

// Computes the extra gold granted by the Labyrinth generous reward modifier.
export function getGenerousGoldBonus(modifiers: LabyrinthModifierKind[], gold: number): number {
  return hasRewardModifier(modifiers, "generous")
    ? Math.floor(gold * LABYRINTH_REWARD_CONFIG.generousGoldBonusFraction)
    : 0;
}

// Applies material reward modifiers without mutating the source inventory.
export function applyLabyrinthRewardMaterialModifiers(
  materials: MaterialInventory,
  modifiers: LabyrinthModifierKind[],
): MaterialInventory {
  if (!hasRewardModifier(modifiers, "scavenger")) return materials;
  return {
    wood: Math.floor(materials.wood * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
    iron: Math.floor(materials.iron * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
    herbs: Math.floor(materials.herbs * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
    food: Math.floor(materials.food * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
    crystal: Math.floor(materials.crystal * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
  };
}

// Indicates whether reward modifiers should force a trinket reward roll.
export function shouldForceTrinketReward(modifiers: LabyrinthModifierKind[]): boolean {
  return hasRewardModifier(modifiers, "collector");
}

// Indicates whether reward modifiers should add a companion card reward step.
export function shouldGrantCompanionReward(modifiers: LabyrinthModifierKind[]): boolean {
  return hasRewardModifier(modifiers, "companion");
}

// Indicates whether reward modifiers should add a potion after the selected reward.
export function shouldGrantAlchemistReward(modifiers: LabyrinthModifierKind[]): boolean {
  return hasRewardModifier(modifiers, "alchemist");
}

// Returns a random potion card from the card library.
export function getRandomPotionCard(rng: () => number = Math.random): BattleCard {
  const potionCards = cardLibrary.filter(
    (c) => (c.id.endsWith("potion") || c.id.includes("potion-")) && c.id !== MIXED_POTION_CARD_ID,
  );
  if (potionCards.length === 0) return cardLibrary[0];
  return potionCards[Math.floor(rng() * potionCards.length)];
}

// Returns random companion cards for the companion reward step.
export function getCompanionCardChoices(rng: () => number = Math.random): BattleCard[] {
  const companions = cardLibrary.filter((c) => c.effects?.some((e) => e.kind === "summon-companion"));
  const shuffled = [...companions];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, LABYRINTH_REWARD_CONFIG.companionCardChoices);
}

// Empty reward state is reused by initialization, reward cleanup, and full run reset.
export function createEmptyRewardState(destinations: Destination[] = []): RewardState {
  return {
    choices: [],
    gold: 0,
    materials: emptyInventory(),
    selectedId: null,
    destinations,
    rewardType: "card",
    selectedBossId: null,
  };
}

function createNextRewardState(rewardState: RewardState): RewardState {
  return { ...createEmptyRewardState(rewardState.destinations), selectedBossId: rewardState.selectedBossId };
}

// Resolves reward-finalization decisions without mutating React state or performing navigation.
export function finalizeRewardState({
  rewardState,
  companionRewardCards,
  contentSystemType,
  currentEnemyType,
  grantAlchemistReward,
}: FinalizeRewardInput): FinalizeRewardResult {
  const selectedChoice = rewardState.selectedId
    ? (rewardState.choices.find((choice) => choice.id === rewardState.selectedId) ?? null)
    : null;

  if (companionRewardCards && companionRewardCards.length > 0) {
    return {
      selectedChoice,
      selectedRewardType: rewardState.rewardType,
      materials: rewardState.materials,
      grantAlchemistReward,
      nextRewardState: {
        choices: companionRewardCards,
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: rewardState.destinations,
        rewardType: "card",
        selectedBossId: rewardState.selectedBossId,
      },
      clearCompanionRewardCards: true,
      route: CONSTANTS.REWARD_ROUTES.COMPANION_REWARD,
    };
  }

  const route: FinalizeRewardRoute =
    contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH
      ? currentEnemyType === CONSTANTS.ENEMY_TYPES.BOSS
        ? CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY
        : CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP
      : contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD
        ? CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY
        : currentEnemyType === CONSTANTS.ENEMY_TYPES.BOSS
          ? CONSTANTS.REWARD_ROUTES.ACT_COMPLETE
          : CONSTANTS.REWARD_ROUTES.DESTINATION;

  return {
    selectedChoice,
    selectedRewardType: rewardState.rewardType,
    materials: rewardState.materials,
    grantAlchemistReward,
    nextRewardState: createNextRewardState(rewardState),
    clearCompanionRewardCards: false,
    route,
  };
}

// Bosses always offer trinkets and route into act-complete handling rather than another node.
export function createBossRewardState({
  gold,
  bossBonus,
  generousBonus,
  talentGoldPerCombat,
  materials,
  trinketIds,
  goldMultiplier = 1,
}: BossRewardInput): RewardState {
  const trinketGoldBonus = getSmugglersMapGoldBonus(trinketIds);
  return {
    rewardType: "trinket",
    choices: selectRewardTrinkets(trinketLibrary, BOSS_TRINKET_REWARD_CHOICES),
    gold: Math.floor((gold + bossBonus + generousBonus + talentGoldPerCombat + trinketGoldBonus) * goldMultiplier),
    materials,
    selectedId: null,
    destinations: [],
    selectedBossId: null,
  };
}

function getSmugglersMapGoldBonus(trinketIds: string[]): number {
  return computeTrinketManifest(trinketIds).smugglersMapGoldBonus;
}

// Calculates whether a combat reward should offer a trinket based on traits and modifiers.
export function calculateCombatTrinketRewardOffer(
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
  return rng() < baseTrinketChance + trinketHoarderBonus;
}

// Combat rewards can be cards or trinkets. Destination choices are supplied by the hook
// because they depend on post-victory run Health/gold and act progression.
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
  const trinketGoldBonus = getSmugglersMapGoldBonus(trinketIds);
  return {
    rewardType: offerTrinket ? "trinket" : "card",
    choices: offerTrinket
      ? selectRewardTrinkets(trinketLibrary, REWARD_CARD_CHOICES)
      : selectRewardCards(runDeck, cardLibrary, REWARD_CARD_CHOICES),
    gold: Math.floor((gold + eliteBonus + generousBonus + talentGoldPerCombat + trinketGoldBonus) * goldMultiplier),
    materials,
    selectedId: null,
    destinations,
    selectedBossId: null,
  };
}

// Computes the total post-victory gold with all run/talent/trinket modifiers applied.
export function getVictoryGoldTotal({
  battleState,
  runTrinkets,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  talentGoldPerCombat,
}: VictoryGoldTotalInput): number {
  const trinketGoldBonus = getSmugglersMapGoldBonus(runTrinkets);
  return battleState.gold + gold + eliteBonus + generousBonus + bossBonus + talentGoldPerCombat + trinketGoldBonus;
}

export function computeVictoryGoldResult({
  battleState,
  runGold,
  runTrinkets,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  talentGoldPerCombat,
  goldMultiplier,
}: VictoryGoldInput): VictoryGoldResult {
  const unmultipliedTotal = getVictoryGoldTotal({
    battleState,
    runTrinkets,
    gold,
    eliteBonus,
    generousBonus,
    bossBonus,
    talentGoldPerCombat,
  });
  const earnedBeforeMultiplier = unmultipliedTotal - runGold;
  return {
    unmultipliedTotal,
    earnedBeforeMultiplier,
    persistedRunGold: runGold + Math.floor(earnedBeforeMultiplier * goldMultiplier),
  };
}
