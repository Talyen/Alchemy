import { LABYRINTH_REWARD_CONFIG } from "@/lib/game-constants";
import { computeTrinketManifest } from "@/lib/trinkets";
import { MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import type { BattleState } from "@/lib/battle";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";

interface VictoryGoldInput {
  battleState: Pick<BattleState, "gold">;
  purseGold: number;
  runBoons: string[];
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  bossBonus: number;
  talentGoldPerCombat: number;
  goldMultiplier: number;
}

interface VictoryGoldResult {
  earnedBeforeMultiplier: number;
  persistedGold: number;
}

interface RewardGoldInput {
  baseGold: number;
  bonusGold: number;
  generousBonus: number;
  talentGoldPerCombat: number;
  trinketIds: string[];
  goldMultiplier: number;
}

function hasRewardModifier(modifiers: EncounterRewardTraitId[], kind: EncounterRewardTraitId): boolean {
  return modifiers.includes(kind);
}

export const shouldGrantCompanionReward = (modifiers: EncounterRewardTraitId[]): boolean =>
  hasRewardModifier(modifiers, "companion");

export const shouldGrantAlchemistReward = (modifiers: EncounterRewardTraitId[]): boolean =>
  hasRewardModifier(modifiers, "alchemist");

export function getActiveRewardModifiersForContentSystem(
  contentSystemType: ContentSystemId,
  modifiers: EncounterRewardTraitId[],
): EncounterRewardTraitId[] {
  return contentSystemType === CONTENT_SYSTEMS.CAMPAIGN ? [] : modifiers;
}

export function getGenerousGoldBonus(modifiers: EncounterRewardTraitId[], gold: number): number {
  return hasRewardModifier(modifiers, "generous")
    ? Math.round(gold * LABYRINTH_REWARD_CONFIG.generousGoldBonusFraction)
    : 0;
}

export function applyLabyrinthRewardMaterialModifiers(
  materials: MaterialInventory,
  modifiers: EncounterRewardTraitId[],
): MaterialInventory {
  if (!hasRewardModifier(modifiers, "scavenger")) return materials;
  return MATERIAL_IDS.reduce<MaterialInventory>((result, material) => {
    result[material] = Math.round(materials[material] * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier);
    return result;
  }, {} as MaterialInventory);
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
  return Math.round(
    (input.baseGold +
      sumGoldBonuses(input.bonusGold, input.generousBonus, input.talentGoldPerCombat, input.trinketIds)) *
      input.goldMultiplier,
  );
}

export function computeVictoryGold({
  battleState,
  purseGold,
  runBoons,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  talentGoldPerCombat,
  goldMultiplier,
}: VictoryGoldInput): VictoryGoldResult {
  const earnedBeforeMultiplier =
    battleState.gold +
    gold +
    sumGoldBonuses(eliteBonus + bossBonus, generousBonus, talentGoldPerCombat, runBoons) -
    purseGold;
  return {
    earnedBeforeMultiplier,
    persistedGold: purseGold + Math.round(earnedBeforeMultiplier * goldMultiplier),
  };
}
