import { LABYRINTH_REWARD_CONFIG } from "@/lib/game-constants";
import { applyScavengerHerbalistModifiers } from "@/lib/homestead/material-rewards";
import { computeTrinketManifest } from "@/lib/trinkets";
import { type MaterialInventory } from "@/lib/homestead/types";
import type { BattleSnapshot } from "@/lib/battle";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";

interface VictoryGoldInput {
  battleState: Pick<BattleSnapshot, "gold">;
  purseGold: number;
  runBoons: string[];
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  wealthyBonus: number;
  bossBonus: number;
  talentGoldPerCombat: number;
  goldMultiplier: number;
}

interface VictoryGoldResult {
  earnedBeforeMultiplier: number;
  persistedGold: number;
}

const COMPANION_REWARD_TRAITS: readonly EncounterRewardTraitId[] = [
  "companion",
  "fletched",
  "wishkeeper",
  "kindred-spoils",
];

export const shouldGrantCompanionReward = (modifiers: EncounterRewardTraitId[]): boolean =>
  COMPANION_REWARD_TRAITS.some((id) => modifiers.includes(id));

export const shouldGrantAlchemistReward = (modifiers: EncounterRewardTraitId[]): boolean =>
  modifiers.includes("alchemist");

export function getActiveRewardModifiersForContentSystem(
  contentSystemType: ContentSystemId,
  modifiers: EncounterRewardTraitId[],
): EncounterRewardTraitId[] {
  return contentSystemType === CONTENT_SYSTEMS.CAMPAIGN ? [] : modifiers;
}

export function getGenerousGoldBonus(modifiers: EncounterRewardTraitId[], gold: number): number {
  return modifiers.includes("generous") ? Math.round(gold * LABYRINTH_REWARD_CONFIG.generousGoldBonusFraction) : 0;
}

export function getWealthyGoldBonus(modifiers: EncounterRewardTraitId[]): number {
  return modifiers.includes("wealthy") ? LABYRINTH_REWARD_CONFIG.wealthyGoldBonus : 0;
}

export function getWellProvisionedHealing(modifiers: EncounterRewardTraitId[], maxHealth: number): number {
  return modifiers.includes("wellProvisioned")
    ? Math.max(1, Math.round(maxHealth * LABYRINTH_REWARD_CONFIG.wellProvisionedHealFraction))
    : 0;
}

export function applyLabyrinthRewardMaterialModifiers(
  materials: MaterialInventory,
  modifiers: EncounterRewardTraitId[],
): MaterialInventory {
  // Thin adapter over the single pipeline owner in homestead/material-rewards.ts.
  return applyScavengerHerbalistModifiers(materials, {
    scavenger: modifiers.includes("scavenger"),
    herbalist: modifiers.includes("herbalist"),
  });
}

export function computeVictoryGold({
  battleState,
  purseGold,
  runBoons,
  gold,
  eliteBonus,
  generousBonus,
  wealthyBonus,
  bossBonus,
  talentGoldPerCombat,
  goldMultiplier,
}: VictoryGoldInput): VictoryGoldResult {
  // Clamp: battle gold below the purse (e.g. spent mid-combat accounting) earns
  // nothing instead of dragging the total negative — matching the Wildwood path.
  const inCombatGold = Math.max(0, battleState.gold - purseGold);
  const earnedBeforeMultiplier =
    inCombatGold +
    gold +
    (eliteBonus +
      bossBonus +
      generousBonus +
      wealthyBonus +
      talentGoldPerCombat +
      computeTrinketManifest(runBoons).smugglersMapGoldBonus);
  return {
    earnedBeforeMultiplier,
    persistedGold: purseGold + Math.round(earnedBeforeMultiplier * goldMultiplier),
  };
}
