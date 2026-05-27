// Victory gold math, labyrinth reward modifiers, and reward gold aggregation.
import { cardLibrary, getStandardPotionPool, type BattleCard } from "@/lib/game-data";
import { LABYRINTH_REWARD_CONFIG } from "@/lib/game-constants";
import { computeTrinketManifest } from "@/lib/trinkets";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { BattleState } from "@/lib/battle";
import { shuffle } from "@/lib/utils";
import { CONSTANTS } from "../types";
import type { ContentSystemId, LabyrinthModifierKind } from "@/lib/content-systems/types";

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

export type RewardGoldInput = {
  baseGold: number;
  bonusGold: number;
  generousBonus: number;
  talentGoldPerCombat: number;
  trinketIds: string[];
  goldMultiplier: number;
};

function hasRewardModifier(modifiers: LabyrinthModifierKind[], kind: LabyrinthModifierKind): boolean {
  return modifiers.includes(kind);
}

function createModifierGuard(kind: LabyrinthModifierKind) {
  return (modifiers: LabyrinthModifierKind[]): boolean => hasRewardModifier(modifiers, kind);
}

export const shouldForceTrinketReward = createModifierGuard("collector");
export const shouldGrantCompanionReward = createModifierGuard("companion");
export const shouldGrantAlchemistReward = createModifierGuard("alchemist");

export function getActiveRewardModifiersForContentSystem(
  contentSystemType: ContentSystemId,
  modifiers: LabyrinthModifierKind[],
): LabyrinthModifierKind[] {
  return contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH ? modifiers : [];
}

export function getGenerousGoldBonus(modifiers: LabyrinthModifierKind[], gold: number): number {
  return hasRewardModifier(modifiers, "generous")
    ? Math.floor(gold * LABYRINTH_REWARD_CONFIG.generousGoldBonusFraction)
    : 0;
}

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

export function getRandomPotionCard(rng: () => number = Math.random): BattleCard {
  const potionCards = getStandardPotionPool();
  const index = Math.floor(rng() * potionCards.length);
  if (process.env.NODE_ENV !== "production" && potionCards.length === 0) {
    console.error("[reward-gold] getRandomPotionCard: no potion cards found in cardLibrary");
  }
  return potionCards[index];
}

export function getCompanionCardChoices(rng: () => number = Math.random): BattleCard[] {
  const companions = cardLibrary.filter((c) => c.effects?.some((e) => e.kind === "summon-companion"));
  return shuffle(companions, rng).slice(0, LABYRINTH_REWARD_CONFIG.companionCardChoices);
}

function getSmugglersMapGoldBonus(trinketIds: string[]): number {
  return computeTrinketManifest(trinketIds).smugglersMapGoldBonus;
}

function sumGoldBonuses(
  bonusGold: number,
  generousBonus: number,
  talentGoldPerCombat: number,
  trinketIds: string[],
): number {
  return bonusGold + generousBonus + talentGoldPerCombat + getSmugglersMapGoldBonus(trinketIds);
}

export function computeRewardGold(input: RewardGoldInput): number {
  return Math.floor(
    (input.baseGold +
      sumGoldBonuses(input.bonusGold, input.generousBonus, input.talentGoldPerCombat, input.trinketIds)) *
      input.goldMultiplier,
  );
}

export function getVictoryGoldTotal({
  battleState,
  runTrinkets,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  talentGoldPerCombat,
}: VictoryGoldTotalInput): number {
  return (
    battleState.gold + gold + sumGoldBonuses(eliteBonus + bossBonus, generousBonus, talentGoldPerCombat, runTrinkets)
  );
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
