// Enemy material loot tables and end-of-run bonus calculations.
// Each enemy drops thematic materials based on its identity.

import type { MaterialId, MaterialInventory } from "./types";
import type { HomesteadEffectManifest } from "./types";
import { emptyInventory, addInventory } from "./inventory";
import { materialCost } from "./costs";
import { HOMESTEAD_LOOT_CONFIG } from "../game-constants";

// Per-enemy loot table: a guaranteed drop, plus possible bonus drops with weight.
interface MaterialLootEntry {
  material: MaterialId;
  min: number;
  max: number;
  weight: number;
}

interface EnemyLootTable {
  guaranteed: MaterialInventory;
  bonuses: MaterialLootEntry[];
}

function lootEntry(material: MaterialId, min: number, max: number, weight = 1): MaterialLootEntry {
  return { material, min, max, weight };
}

const enemyLootTables: Record<string, EnemyLootTable> = {
  skeleton: {
    guaranteed: emptyInventory(),
    bonuses: [lootEntry("herbs", 0, 1, 0.3)],
  },
  goblin: {
    guaranteed: materialCost({ wood: 1, food: 1 }),
    bonuses: [lootEntry("wood", 0, 1, 0.4)],
  },
  mimic: {
    guaranteed: materialCost({ iron: 2 }),
    bonuses: [lootEntry("crystal", 0, 1, 0.5), lootEntry("iron", 0, 1, 0.4)],
  },
  "mud-elemental": {
    guaranteed: materialCost({ herbs: 1 }),
    bonuses: [],
  },
  necromancer: {
    guaranteed: materialCost({ herbs: 2, crystal: 1 }),
    bonuses: [lootEntry("crystal", 0, 1, 0.3), lootEntry("herbs", 0, 1, 0.5)],
  },
  "plague-doctor": {
    guaranteed: materialCost({ herbs: 2 }),
    bonuses: [lootEntry("herbs", 0, 1, 0.4)],
  },
  "forge-golem": {
    guaranteed: materialCost({ iron: 3, crystal: 1 }),
    bonuses: [lootEntry("iron", 0, 2, 0.6), lootEntry("crystal", 0, 1, 0.4)],
  },
  frostwarden: {
    guaranteed: materialCost({ crystal: 3 }),
    bonuses: [lootEntry("crystal", 0, 2, 0.6), lootEntry("iron", 0, 1, 0.3)],
  },
  "blight-treant": {
    guaranteed: materialCost({ wood: 2, herbs: 2 }),
    bonuses: [lootEntry("wood", 0, 2, 0.6), lootEntry("herbs", 0, 2, 0.5)],
  },
  "living-armor": {
    guaranteed: materialCost({ iron: 2 }),
    bonuses: [lootEntry("iron", 0, 1, 0.4), lootEntry("crystal", 0, 1, 0.3)],
  },
  "iron-bear": {
    guaranteed: materialCost({ iron: 2, food: 1 }),
    bonuses: [lootEntry("iron", 0, 2, 0.5), lootEntry("food", 0, 1, 0.4)],
  },
  "fire-elemental": {
    guaranteed: materialCost({ iron: 1, crystal: 1 }),
    bonuses: [lootEntry("crystal", 0, 1, 0.4)],
  },
  "frost-elemental": {
    guaranteed: materialCost({ crystal: 2 }),
    bonuses: [lootEntry("crystal", 0, 1, 0.6)],
  },
  slime: {
    guaranteed: materialCost({ food: 1 }),
    bonuses: [lootEntry("herbs", 0, 1, 0.3)],
  },
};

// Exported for the bestiary↔loot parity test; not a production lookup.
export const enemyLootTableIds = Object.keys(enemyLootTables);

function rollBonuses(table: EnemyLootTable, rng: () => number): MaterialInventory {
  const result = emptyInventory();
  for (const bonus of table.bonuses) {
    if (rng() < bonus.weight) {
      result[bonus.material] = bonus.min + Math.floor(rng() * (bonus.max - bonus.min + 1));
    }
  }
  return result;
}

// Apply enemy-type multiplier to loot: elites get 1.3x, bosses get 3x.
function applyTypeMultiplier(loot: MaterialInventory, enemyType: string): MaterialInventory {
  const { enemyTypeMultipliers } = HOMESTEAD_LOOT_CONFIG;
  const multiplier =
    enemyType === "boss"
      ? enemyTypeMultipliers.boss
      : enemyType === "elite"
        ? enemyTypeMultipliers.elite
        : enemyTypeMultipliers.normal;
  if (multiplier === enemyTypeMultipliers.normal) return loot;
  const result = { ...loot };
  for (const mat of Object.keys(result) as MaterialId[]) {
    result[mat] = Math.floor(result[mat] * multiplier);
  }
  return result;
}

export function getEnemyMaterialLoot(enemyId: string, enemyType: string, rng: () => number): MaterialInventory {
  const table = enemyLootTables[enemyId];
  if (!table) return emptyInventory();
  const guaranteed = { ...table.guaranteed };
  const bonuses = rollBonuses(table, rng);
  const combined = addInventory(guaranteed, bonuses);
  return applyTypeMultiplier(combined, enemyType);
}

// Applies persistent material find multipliers to discovered material rewards.
export function applyMaterialFindBonus(
  materials: MaterialInventory,
  effects: Pick<HomesteadEffectManifest, "herbFindBonus">,
): MaterialInventory {
  if (effects.herbFindBonus <= 0 || materials.herbs <= 0) return materials;
  return { ...materials, herbs: Math.floor(materials.herbs * (1 + effects.herbFindBonus)) };
}

type EndOfRunHomesteadEffects = Pick<
  HomesteadEffectManifest,
  "endRunFoodPerRoom" | "endRunHerbsPerRoom" | "endRunCrystalPerRoom" | "herbFindBonus"
>;

// Applies homestead flat end-of-run yields, then herb find multiplier.
export function applyEndOfRunHomesteadBonuses(
  base: MaterialInventory,
  effects: EndOfRunHomesteadEffects,
  roomsEncountered: number,
): MaterialInventory {
  const withFlatYields = {
    ...base,
    herbs: base.herbs + effects.endRunHerbsPerRoom * roomsEncountered,
    food: base.food + effects.endRunFoodPerRoom * roomsEncountered,
    crystal: base.crystal + effects.endRunCrystalPerRoom * roomsEncountered,
  };
  return applyMaterialFindBonus(withFlatYields, effects);
}
