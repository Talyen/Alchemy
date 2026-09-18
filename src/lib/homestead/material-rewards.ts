import { MATERIAL_IDS, type MaterialId, type MaterialInventory } from "./types";
import type { HomesteadEffectManifest } from "./types";
import { emptyInventory, materialAmount } from "./inventory";
import { materialCost } from "./data-builders";
import { HOMESTEAD_LOOT_MULTIPLIERS, LABYRINTH_REWARD_CONFIG } from "../game-constants";

export interface MaterialLootEntry {
  material: MaterialId;
  min: number;
  max: number;
  /** Probability in (0, 1] that this bonus pays out. A hit always pays at least `min` (which is ≥ 1). */
  chance: number;
}

export interface EnemyLootTable {
  guaranteed: MaterialInventory;
  bonuses: MaterialLootEntry[];
}

function lootEntry(material: MaterialId, min: number, max: number, chance = 1): MaterialLootEntry {
  return { material, min, max, chance };
}

export const enemyLootTables: Record<string, EnemyLootTable> = {
  skeleton: {
    guaranteed: emptyInventory(),
    bonuses: [lootEntry("herbs", 1, 1, 0.3)],
  },
  goblin: {
    guaranteed: materialCost({ wood: 1, food: 1 }),
    bonuses: [lootEntry("wood", 1, 1, 0.4), lootEntry("hide", 1, 1, 0.3)],
  },
  mimic: {
    guaranteed: materialCost({ iron: 2 }),
    bonuses: [lootEntry("gems", 1, 1, 0.5), lootEntry("iron", 1, 1, 0.4)],
  },
  "mud-elemental": {
    guaranteed: materialCost({ herbs: 1 }),
    bonuses: [],
  },
  necromancer: {
    guaranteed: materialCost({ herbs: 2, gems: 1 }),
    bonuses: [lootEntry("gems", 1, 1, 0.3), lootEntry("herbs", 1, 1, 0.5)],
  },
  "plague-doctor": {
    guaranteed: materialCost({ herbs: 2 }),
    bonuses: [lootEntry("herbs", 1, 1, 0.4)],
  },
  "forge-golem": {
    guaranteed: materialCost({ iron: 3, gems: 1 }),
    bonuses: [lootEntry("iron", 1, 2, 0.6), lootEntry("gems", 1, 1, 0.4), lootEntry("stone", 1, 1, 0.5)],
  },
  frostwarden: {
    guaranteed: materialCost({ gems: 3 }),
    bonuses: [lootEntry("gems", 1, 2, 0.6), lootEntry("iron", 1, 1, 0.3)],
  },
  "blight-treant": {
    guaranteed: materialCost({ wood: 2, herbs: 2 }),
    bonuses: [lootEntry("wood", 1, 2, 0.6), lootEntry("herbs", 1, 2, 0.5)],
  },
  "living-armor": {
    guaranteed: materialCost({ iron: 2 }),
    bonuses: [lootEntry("iron", 1, 1, 0.4), lootEntry("gems", 1, 1, 0.3)],
  },
  "iron-bear": {
    guaranteed: materialCost({ iron: 2, food: 1 }),
    bonuses: [lootEntry("iron", 1, 2, 0.5), lootEntry("food", 1, 1, 0.4), lootEntry("hide", 1, 1, 0.5)],
  },
  "fire-elemental": {
    guaranteed: materialCost({ iron: 1, gems: 1 }),
    bonuses: [lootEntry("gems", 1, 1, 0.4)],
  },
  "frost-elemental": {
    guaranteed: materialCost({ gems: 2 }),
    bonuses: [lootEntry("gems", 1, 1, 0.6)],
  },
  slime: {
    guaranteed: materialCost({ food: 1 }),
    bonuses: [lootEntry("herbs", 1, 1, 0.3)],
  },
  "will-o-wisp": {
    guaranteed: materialCost({ gems: 2 }),
    bonuses: [lootEntry("gems", 1, 1, 0.6)],
  },
  bandit: {
    guaranteed: materialCost({ wood: 1, food: 1 }),
    bonuses: [lootEntry("wood", 1, 1, 0.4), lootEntry("hide", 1, 1, 0.3)],
  },
  ogre: {
    guaranteed: materialCost({ iron: 2, food: 1 }),
    bonuses: [lootEntry("iron", 1, 1, 0.5), lootEntry("hide", 1, 1, 0.4)],
  },
  "fire-imp": {
    guaranteed: materialCost({ iron: 1, gems: 1 }),
    bonuses: [lootEntry("gems", 1, 1, 0.4)],
  },
  hellhound: {
    guaranteed: materialCost({ food: 2, iron: 1 }),
    bonuses: [lootEntry("food", 1, 1, 0.4), lootEntry("hide", 1, 1, 0.4)],
  },
  pyromancer: {
    guaranteed: materialCost({ gems: 2, iron: 1 }),
    bonuses: [lootEntry("gems", 1, 1, 0.5)],
  },
  "giant-spider": {
    guaranteed: materialCost({ herbs: 1, food: 1 }),
    bonuses: [lootEntry("herbs", 1, 1, 0.5), lootEntry("hide", 1, 1, 0.4)],
  },
  "giant-snake": {
    guaranteed: materialCost({ herbs: 2 }),
    bonuses: [lootEntry("herbs", 1, 1, 0.5), lootEntry("hide", 1, 1, 0.5)],
  },
  "blood-cultist": {
    guaranteed: materialCost({ herbs: 2, gems: 1 }),
    bonuses: [lootEntry("gems", 1, 1, 0.4)],
  },
  "dire-wolf": {
    guaranteed: materialCost({ food: 2 }),
    bonuses: [lootEntry("food", 1, 1, 0.5), lootEntry("hide", 1, 1, 0.5)],
  },
  vampire: {
    guaranteed: materialCost({ herbs: 2, food: 1 }),
    bonuses: [lootEntry("gems", 1, 1, 0.4)],
  },
  "blood-countess": {
    guaranteed: materialCost({ herbs: 3, gems: 1 }),
    bonuses: [lootEntry("herbs", 1, 2, 0.6), lootEntry("gems", 1, 1, 0.4)],
  },
  zealot: {
    guaranteed: materialCost({ food: 1, gems: 1 }),
    bonuses: [lootEntry("food", 1, 1, 0.4)],
  },
  cleric: {
    guaranteed: materialCost({ herbs: 1, gems: 1 }),
    bonuses: [lootEntry("herbs", 1, 1, 0.4)],
  },
  inquisitor: {
    guaranteed: materialCost({ iron: 1, gems: 1 }),
    bonuses: [lootEntry("iron", 1, 1, 0.4)],
  },
  paladin: {
    guaranteed: materialCost({ iron: 2, gems: 1 }),
    bonuses: [lootEntry("iron", 1, 1, 0.5)],
  },
  seraph: {
    guaranteed: materialCost({ gems: 3, herbs: 1 }),
    bonuses: [lootEntry("gems", 1, 2, 0.6), lootEntry("herbs", 1, 1, 0.4)],
  },
  "winter-wolf": {
    guaranteed: materialCost({ food: 1, gems: 1 }),
    bonuses: [lootEntry("gems", 1, 1, 0.4), lootEntry("hide", 1, 1, 0.4)],
  },
  "ice-wraith": {
    guaranteed: materialCost({ gems: 2, herbs: 1 }),
    bonuses: [lootEntry("gems", 1, 1, 0.5)],
  },
  yeti: {
    guaranteed: materialCost({ food: 2, iron: 1 }),
    bonuses: [lootEntry("food", 1, 1, 0.4), lootEntry("hide", 1, 1, 0.4)],
  },
  banshee: {
    guaranteed: materialCost({ herbs: 1, gems: 1 }),
    bonuses: [lootEntry("herbs", 1, 1, 0.4)],
  },
  brawler: {
    guaranteed: materialCost({ iron: 2, food: 1 }),
    bonuses: [lootEntry("iron", 1, 1, 0.5)],
  },
  "stone-golem": {
    guaranteed: materialCost({ stone: 3 }),
    bonuses: [lootEntry("iron", 1, 2, 0.5), lootEntry("stone", 1, 1, 0.4)],
  },
  "earth-elemental": {
    guaranteed: materialCost({ stone: 1, herbs: 1 }),
    bonuses: [lootEntry("stone", 1, 1, 0.4)],
  },
  "stone-titan": {
    guaranteed: materialCost({ stone: 3, gems: 1 }),
    bonuses: [lootEntry("iron", 1, 2, 0.6), lootEntry("gems", 1, 1, 0.4)],
  },
};

export const enemyLootTableIds = Object.keys(enemyLootTables);

function applyTypeMultiplier(loot: MaterialInventory, enemyType: string): MaterialInventory {
  const multiplier =
    enemyType === "boss"
      ? HOMESTEAD_LOOT_MULTIPLIERS.boss
      : enemyType === "elite"
        ? HOMESTEAD_LOOT_MULTIPLIERS.elite
        : HOMESTEAD_LOOT_MULTIPLIERS.normal;
  if (multiplier === HOMESTEAD_LOOT_MULTIPLIERS.normal) return loot;
  const result = { ...loot };
  for (const mat of MATERIAL_IDS) {
    // Battle-standard rounding: Math.round keeps elite multi-drops meaningfully
    // above normal (2 × 1.3 = 2.6 → 3) where flooring would erase the bonus.
    // Singleton drops stay identical to normal (1 × 1.3 = 1.3 → 1) by design.
    result[mat] = Math.round(materialAmount(result, mat) * multiplier);
  }
  return result;
}

export function getEnemyMaterialLoot(enemyId: string, enemyType: string, rng: () => number): MaterialInventory {
  const table = enemyLootTables[enemyId];
  if (!table) return emptyInventory();
  const loot: MaterialInventory = { ...table.guaranteed };
  for (const bonus of table.bonuses) {
    if (rng() < bonus.chance) {
      loot[bonus.material] += bonus.min + Math.floor(rng() * (bonus.max - bonus.min + 1));
    }
  }
  return applyTypeMultiplier(loot, enemyType);
}

export function applyMaterialFindBonus(
  materials: MaterialInventory,
  effects: Pick<HomesteadEffectManifest, "herbFindBonus">,
): MaterialInventory {
  if (effects.herbFindBonus <= 0 || materials.herbs <= 0) return materials;
  return { ...materials, herbs: Math.round(materials.herbs * (1 + effects.herbFindBonus)) };
}

type EndOfRunHomesteadEffects = Pick<
  HomesteadEffectManifest,
  | "endRunFoodPerRoom"
  | "endRunHerbsPerRoom"
  | "endRunHidePerRoom"
  | "endRunGemsPerRoom"
  | "endRunIronPerRoom"
  | "endRunWoodPerRoom"
  | "herbFindBonus"
>;

export function applyEndOfRunHomesteadBonuses(
  base: MaterialInventory,
  effects: EndOfRunHomesteadEffects,
  roomsEncountered: number,
): MaterialInventory {
  const roomCount = Math.max(0, roomsEncountered);
  const withFlatYields = {
    ...base,
    herbs: base.herbs + (effects.endRunHerbsPerRoom ?? 0) * roomCount,
    food: base.food + (effects.endRunFoodPerRoom ?? 0) * roomCount,
    hide: base.hide + (effects.endRunHidePerRoom ?? 0) * roomCount,
    gems: base.gems + (effects.endRunGemsPerRoom ?? 0) * roomCount,
    iron: base.iron + (effects.endRunIronPerRoom ?? 0) * roomCount,
    wood: base.wood + (effects.endRunWoodPerRoom ?? 0) * roomCount,
  };
  return applyMaterialFindBonus(withFlatYields, effects);
}

// ── Material reward policy ──────────────────────────────────────────────
// Single owner for which modifiers apply to which source:
//   combat victory: enemy table → elite/boss multiplier → herb-find → scavenger → herbalist
//   mystery grant:  fixed amount → herb-find only (location traits don't apply off-map)
//   wish gems:      flat pendingMaterials append (no find bonus; gems aren't herbs)
//   gear salvage:   fixed definition value + rolled currencies (no homestead modifiers)
//   end of run:     flat per-room yields → herb-find (via applyEndOfRunHomesteadBonuses)
// The Wildwood "no materials" gate lives separately in run/run-materials.ts.

export interface ScavengerHerbalistFlags {
  scavenger: boolean;
  herbalist: boolean;
}

export function applyScavengerHerbalistModifiers(
  materials: MaterialInventory,
  flags: ScavengerHerbalistFlags,
): MaterialInventory {
  let next: MaterialInventory = { ...materials };
  let mutated = false;
  if (flags.scavenger) {
    mutated = true;
    next = emptyInventory();
    for (const material of MATERIAL_IDS) {
      next[material] = Math.round((materials[material] ?? 0) * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier);
    }
  }
  if (flags.herbalist) {
    mutated = true;
    // Herbalist lands after scavenger, so it tops up already-doubled herbs without itself being doubled.
    next.herbs = (next.herbs ?? 0) + LABYRINTH_REWARD_CONFIG.herbalistHerbBonus;
  }
  return mutated ? next : materials;
}

export interface CombatMaterialRewardInput {
  enemyId: string;
  enemyType: string;
  effects: Pick<HomesteadEffectManifest, "herbFindBonus">;
  scavenger: boolean;
  herbalist: boolean;
  rng: () => number;
}

/** Full combat-victory material pipeline: table → type multiplier → herb-find → scavenger → herbalist. */
export function computeCombatMaterialReward(input: CombatMaterialRewardInput): MaterialInventory {
  const base = getEnemyMaterialLoot(input.enemyId, input.enemyType, input.rng);
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
