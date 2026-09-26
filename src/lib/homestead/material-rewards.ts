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

function bonus(material: MaterialId, chance: number, max = 1): MaterialLootEntry {
  return { material, min: 1, max, chance };
}

// Compact loot row: guaranteed partial plus bonus triples. Defaults (min 1,
// max 1) cover every current bonus; max 2 is passed explicitly where needed.
function lootTable(guaranteed: Partial<MaterialInventory>, bonuses: MaterialLootEntry[] = []): EnemyLootTable {
  return { guaranteed: materialCost(guaranteed), bonuses };
}

export const enemyLootTables: Record<string, EnemyLootTable> = {
  skeleton: lootTable({}, [bonus("herbs", 0.3)]),
  goblin: lootTable({ wood: 1, food: 1 }, [bonus("wood", 0.4), bonus("hide", 0.3)]),
  mimic: lootTable({ iron: 2 }, [bonus("gems", 0.5), bonus("iron", 0.4)]),
  "mud-elemental": lootTable({ herbs: 1 }),
  necromancer: lootTable({ herbs: 2, gems: 1 }, [bonus("gems", 0.3), bonus("herbs", 0.5)]),
  "plague-doctor": lootTable({ herbs: 2 }, [bonus("herbs", 0.4)]),
  "forge-golem": lootTable({ iron: 3, gems: 1 }, [bonus("iron", 0.6, 2), bonus("gems", 0.4), bonus("stone", 0.5)]),
  frostwarden: lootTable({ gems: 3 }, [bonus("gems", 0.6, 2), bonus("iron", 0.3)]),
  "blight-treant": lootTable({ wood: 2, herbs: 2 }, [bonus("wood", 0.6, 2), bonus("herbs", 0.5, 2)]),
  "living-armor": lootTable({ iron: 2 }, [bonus("iron", 0.4), bonus("gems", 0.3)]),
  "iron-bear": lootTable({ iron: 2, food: 1 }, [bonus("iron", 0.5, 2), bonus("food", 0.4), bonus("hide", 0.5)]),
  "fire-elemental": lootTable({ iron: 1, gems: 1 }, [bonus("gems", 0.4)]),
  "frost-elemental": lootTable({ gems: 2 }, [bonus("gems", 0.6)]),
  slime: lootTable({ food: 1 }, [bonus("herbs", 0.3)]),
  "will-o-wisp": lootTable({ gems: 2 }, [bonus("gems", 0.6)]),
  bandit: lootTable({ wood: 1, food: 1 }, [bonus("wood", 0.4), bonus("hide", 0.3)]),
  ogre: lootTable({ iron: 2, food: 1 }, [bonus("iron", 0.5), bonus("hide", 0.4)]),
  "fire-imp": lootTable({ iron: 1, gems: 1 }, [bonus("gems", 0.4)]),
  hellhound: lootTable({ food: 2, iron: 1 }, [bonus("food", 0.4), bonus("hide", 0.4)]),
  pyromancer: lootTable({ gems: 2, iron: 1 }, [bonus("gems", 0.5)]),
  "giant-spider": lootTable({ herbs: 1, food: 1 }, [bonus("herbs", 0.5), bonus("hide", 0.4)]),
  "giant-snake": lootTable({ herbs: 2 }, [bonus("herbs", 0.5), bonus("hide", 0.5)]),
  "blood-cultist": lootTable({ herbs: 2, gems: 1 }, [bonus("gems", 0.4)]),
  "dire-wolf": lootTable({ food: 2 }, [bonus("food", 0.5), bonus("hide", 0.5)]),
  vampire: lootTable({ herbs: 2, food: 1 }, [bonus("gems", 0.4)]),
  "blood-countess": lootTable({ herbs: 3, gems: 1 }, [bonus("herbs", 0.6, 2), bonus("gems", 0.4)]),
  zealot: lootTable({ food: 1, gems: 1 }, [bonus("food", 0.4)]),
  cleric: lootTable({ herbs: 1, gems: 1 }, [bonus("herbs", 0.4)]),
  inquisitor: lootTable({ iron: 1, gems: 1 }, [bonus("iron", 0.4)]),
  paladin: lootTable({ iron: 2, gems: 1 }, [bonus("iron", 0.5)]),
  seraph: lootTable({ gems: 3, herbs: 1 }, [bonus("gems", 0.6, 2), bonus("herbs", 0.4)]),
  "winter-wolf": lootTable({ food: 1, gems: 1 }, [bonus("gems", 0.4), bonus("hide", 0.4)]),
  "ice-wraith": lootTable({ gems: 2, herbs: 1 }, [bonus("gems", 0.5)]),
  yeti: lootTable({ food: 2, iron: 1 }, [bonus("food", 0.4), bonus("hide", 0.4)]),
  banshee: lootTable({ herbs: 1, gems: 1 }, [bonus("herbs", 0.4)]),
  brawler: lootTable({ iron: 2, food: 1 }, [bonus("iron", 0.5)]),
  "stone-golem": lootTable({ stone: 3 }, [bonus("iron", 0.5, 2), bonus("stone", 0.4)]),
  "earth-elemental": lootTable({ stone: 1, herbs: 1 }, [bonus("stone", 0.4)]),
  "stone-titan": lootTable({ stone: 3, gems: 1 }, [bonus("iron", 0.6, 2), bonus("gems", 0.4)]),
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
  | "endRunStonePerRoom"
  | "endRunWishPerRoom"
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
    stone: base.stone + (effects.endRunStonePerRoom ?? 0) * roomCount,
    herbs: base.herbs + (effects.endRunHerbsPerRoom ?? 0) * roomCount,
    food: base.food + (effects.endRunFoodPerRoom ?? 0) * roomCount,
    hide: base.hide + (effects.endRunHidePerRoom ?? 0) * roomCount,
    gems:
      base.gems +
      (effects.endRunGemsPerRoom ?? 0) * roomCount +
      (effects.endRunWishPerRoom ?? 0) * Math.floor(roomCount / 2),
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
