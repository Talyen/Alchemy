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

export function applyMaterialFindBonus(
  materials: MaterialInventory,
  effects: Pick<HomesteadEffectManifest, "herbFindBonus">,
): MaterialInventory {
  if (effects.herbFindBonus <= 0 || materials.herbs <= 0) return materials;
  return { ...materials, herbs: Math.round(materials.herbs * (1 + effects.herbFindBonus)) };
}

const END_RUN_MATERIAL_YIELDS = {
  stone: "endRunStonePerRoom",
  herbs: "endRunHerbsPerRoom",
  food: "endRunFoodPerRoom",
  hide: "endRunHidePerRoom",
  gems: "endRunGemsPerRoom",
  iron: "endRunIronPerRoom",
  wood: "endRunWoodPerRoom",
} as const satisfies Record<MaterialId, keyof HomesteadEffectManifest>;

type EndOfRunHomesteadEffects = Pick<
  HomesteadEffectManifest,
  (typeof END_RUN_MATERIAL_YIELDS)[MaterialId] | "endRunWishPerRoom" | "herbFindBonus"
>;

export function applyEndOfRunHomesteadBonuses(
  base: MaterialInventory,
  effects: EndOfRunHomesteadEffects,
  roomsEncountered: number,
): MaterialInventory {
  const roomCount = Math.max(0, roomsEncountered);
  const withFlatYields = { ...base };
  for (const material of MATERIAL_IDS) {
    withFlatYields[material] += (effects[END_RUN_MATERIAL_YIELDS[material]] ?? 0) * roomCount;
  }
  withFlatYields.gems += (effects.endRunWishPerRoom ?? 0) * Math.floor(roomCount / 2);
  return applyMaterialFindBonus(withFlatYields, effects);
}

// ── Material reward policy ──────────────────────────────────────────────
// Single owner for which modifiers apply to which source:
//   combat victory: shared bundles by encounter type and band → herb-find → scavenger → herbalist
//   mystery grant:  fixed amount → herb-find only (location traits don't apply off-map)
//   wish gems:      flat pendingMaterials append (no find bonus; gems aren't herbs)
//   gear salvage:   fixed definition value + rolled currencies (no homestead modifiers)
//   end of run:     flat per-room yields → herb-find (via applyEndOfRunHomesteadBonuses)

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
  effects: Pick<HomesteadEffectManifest, "herbFindBonus">;
  scavenger: boolean;
  herbalist: boolean;
  rng: () => number;
}

/** Full combat-victory material pipeline: shared bundles → herb-find → scavenger → herbalist. */
export function computeCombatMaterialReward(input: CombatMaterialRewardInput): MaterialInventory {
  const base = getCombatMaterialLoot(input.enemyType, input.progressionBand, input.rng);
  return applyScavengerHerbalistModifiers(applyMaterialFindBonus(base, input.effects), input);
}

/** Mystery grants skip location traits; only the homestead herb-find bonus applies. */
export function computeMysteryMaterialReward(input: {
  material: MaterialId;
  amount: number;
  effects: Pick<HomesteadEffectManifest, "herbFindBonus">;
}): MaterialInventory {
  const found = emptyInventory();
  found[input.material] = input.amount;
  return applyMaterialFindBonus(found, input.effects);
}
