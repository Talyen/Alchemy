import { MATERIAL_IDS, type MaterialId, type MaterialInventory } from "./types";
import type { HomesteadEffectManifest } from "./types";
import { emptyInventory } from "./inventory";
import { COMBAT_MATERIAL_QUANTITIES, COMBAT_MATERIAL_BUNDLE_SIZE, LABYRINTH_REWARD_CONFIG } from "../game-constants";
import { rngInt } from "@/lib/rng";

function multiplyMaterials(materials: MaterialInventory, multiplier: number): MaterialInventory {
  const result = { ...materials };
  for (const material of MATERIAL_IDS) result[material] = Math.round((materials[material] ?? 0) * multiplier);
  return result;
}

/** Shared base payout: equal material odds per bundle, with replacement. */
export function getCombatMaterialLoot(
  enemyType: string,
  progressionBand: number,
  rng: () => number,
): MaterialInventory {
  const bandIndex = Math.min(2, Math.max(0, Math.floor(progressionBand) - 1));
  const quantities =
    enemyType === "boss"
      ? COMBAT_MATERIAL_QUANTITIES.boss
      : enemyType === "elite"
        ? COMBAT_MATERIAL_QUANTITIES.elite
        : COMBAT_MATERIAL_QUANTITIES.normal;
  const quantity = quantities[bandIndex]!;
  const loot = emptyInventory();
  for (let remaining = quantity; remaining > 0; remaining -= COMBAT_MATERIAL_BUNDLE_SIZE) {
    const material = MATERIAL_IDS[rngInt(rng, MATERIAL_IDS.length)]!;
    loot[material] += Math.min(COMBAT_MATERIAL_BUNDLE_SIZE, remaining);
  }
  return loot;
}

const MATERIAL_FIND_KEYS = {
  wood: "woodFindBonus",
  stone: "stoneFindBonus",
  iron: "ironFindBonus",
  food: "foodFindBonus",
  herbs: "herbFindBonus",
  hide: "hideFindBonus",
  gems: "gemFindBonus",
} as const satisfies Record<MaterialId, keyof HomesteadEffectManifest>;

type MaterialFindEffects = Pick<HomesteadEffectManifest, (typeof MATERIAL_FIND_KEYS)[MaterialId]>;

/** Apply once to a source payout, after its ordinary modifiers, without changing RNG. */
export function applyRewardFindBonus(amount: number, bonus: number): number {
  return amount > 0 ? Math.round(amount * (1 + Math.max(0, bonus))) : 0;
}

export function computeGoldReward(amount: number, multiplier: number, findBonus: number): number {
  return applyRewardFindBonus(Math.round(amount * multiplier), findBonus);
}

export function applyMaterialFindBonus(materials: MaterialInventory, effects: MaterialFindEffects): MaterialInventory {
  const found = { ...materials };
  for (const material of MATERIAL_IDS) {
    found[material] = applyRewardFindBonus(materials[material], effects[MATERIAL_FIND_KEYS[material]]);
  }
  return found;
}

// Reward policy: combat bundles → location modifiers → find bonuses.
// Mystery payouts receive find bonuses at their source.
// Salvage, generated Gold, and run-end accounting never apply them.

export interface ScavengerHerbalistFlags {
  scavenger: boolean;
  herbalist: boolean;
}

export function applyScavengerHerbalistModifiers(
  materials: MaterialInventory,
  flags: ScavengerHerbalistFlags,
): MaterialInventory {
  if (!flags.scavenger && !flags.herbalist) return materials;
  const next = flags.scavenger
    ? multiplyMaterials(materials, LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier)
    : { ...materials };
  if (flags.herbalist) {
    // Herbalist lands after scavenger, so it tops up already-doubled herbs without itself being doubled.
    next.herbs = (next.herbs ?? 0) + LABYRINTH_REWARD_CONFIG.herbalistHerbBonus;
  }
  return next;
}

export interface CombatMaterialRewardInput {
  progressionBand: number;
  enemyType: string;
  effects: MaterialFindEffects;
  scavenger: boolean;
  herbalist: boolean;
  rng: () => number;
}

/** Shared bundles → scavenger → herbalist → Homestead find bonuses. */
export function computeCombatMaterialReward(input: CombatMaterialRewardInput): MaterialInventory {
  const base = getCombatMaterialLoot(input.enemyType, input.progressionBand, input.rng);
  return applyMaterialFindBonus(applyScavengerHerbalistModifiers(base, input), input.effects);
}

/** Mystery grants skip location traits and apply the matching resource bonus. */
export function computeMysteryMaterialReward(input: {
  material: MaterialId;
  amount: number;
  effects: MaterialFindEffects;
}): MaterialInventory {
  const found = emptyInventory();
  found[input.material] = applyRewardFindBonus(input.amount, input.effects[MATERIAL_FIND_KEYS[input.material]]);
  return found;
}
