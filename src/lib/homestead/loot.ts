// Enemy material loot tables and end-of-run bonus calculations.
// Each enemy drops thematic materials based on its identity.

import type { MaterialId, MaterialInventory } from "./types";
import { emptyInventory, addInventory } from "./types";

// Per-enemy loot table: a guaranteed drop, plus possible bonus drops with weight.
type MaterialLootEntry = { material: MaterialId; min: number; max: number; weight: number };

type EnemyLootTable = {
  guaranteed: MaterialInventory;
  bonuses: MaterialLootEntry[];
};

function lootEntry(material: MaterialId, min: number, max: number, weight = 1): MaterialLootEntry {
  return { material, min, max, weight };
}

const enemyLootTables: Record<string, EnemyLootTable> = {
  skeleton: {
    guaranteed: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    bonuses: [lootEntry("herbs", 0, 1, 0.3)],
  },
  goblin: {
    guaranteed: { wood: 1, iron: 0, herbs: 0, food: 1, crystal: 0 },
    bonuses: [lootEntry("wood", 0, 1, 0.4)],
  },
  imp: {
    guaranteed: { wood: 0, iron: 0, herbs: 1, food: 0, crystal: 0 },
    bonuses: [lootEntry("crystal", 0, 1, 0.1)],
  },
  "lizard-scout": {
    guaranteed: { wood: 0, iron: 0, herbs: 1, food: 0, crystal: 0 },
    bonuses: [lootEntry("herbs", 0, 1, 0.3)],
  },
  mimic: {
    guaranteed: { wood: 0, iron: 2, herbs: 0, food: 0, crystal: 0 },
    bonuses: [lootEntry("crystal", 0, 1, 0.5), lootEntry("iron", 0, 1, 0.4)],
  },
  "mud-elemental": {
    guaranteed: { wood: 0, iron: 0, herbs: 1, food: 0, crystal: 0 },
    bonuses: [],
  },
  necromancer: {
    guaranteed: { wood: 0, iron: 0, herbs: 2, food: 0, crystal: 1 },
    bonuses: [lootEntry("crystal", 0, 1, 0.3), lootEntry("herbs", 0, 1, 0.5)],
  },
  "plague-doctor": {
    guaranteed: { wood: 0, iron: 0, herbs: 2, food: 0, crystal: 0 },
    bonuses: [lootEntry("herbs", 0, 1, 0.4)],
  },
  "act-i-boss": {
    guaranteed: { wood: 0, iron: 3, herbs: 0, food: 0, crystal: 1 },
    bonuses: [lootEntry("iron", 0, 2, 0.6), lootEntry("crystal", 0, 1, 0.4)],
  },
  "act-ii-boss": {
    guaranteed: { wood: 0, iron: 3, herbs: 0, food: 0, crystal: 1 },
    bonuses: [lootEntry("iron", 0, 2, 0.6), lootEntry("crystal", 0, 1, 0.4)],
  },
  "act-iii-boss": {
    guaranteed: { wood: 1, iron: 2, herbs: 1, food: 2, crystal: 2 },
    bonuses: [lootEntry("crystal", 0, 2, 0.5)],
  },
};

function rollBonuses(table: EnemyLootTable): MaterialInventory {
  const result = emptyInventory();
  for (const bonus of table.bonuses) {
    if (Math.random() < bonus.weight) {
      result[bonus.material] = bonus.min + Math.floor(Math.random() * (bonus.max - bonus.min + 1));
    }
  }
  return result;
}

// Apply enemy-type multiplier to loot: elites get 2x, bosses get 3x.
function applyTypeMultiplier(loot: MaterialInventory, enemyType: string): MaterialInventory {
  const mul = enemyType === "boss" ? 3 : enemyType === "elite" ? 2 : 1;
  if (mul === 1) return loot;
  const result = { ...loot };
  for (const mat of Object.keys(result) as MaterialId[]) {
    result[mat] = Math.floor(result[mat] * mul);
  }
  return result;
}

export function getEnemyMaterialLoot(enemyId: string, enemyType: string): MaterialInventory {
  const table = enemyLootTables[enemyId];
  if (!table) return emptyInventory();
  const guaranteed = { ...table.guaranteed };
  const bonuses = rollBonuses(table);
  const combined = addInventory(guaranteed, bonuses);
  return applyTypeMultiplier(combined, enemyType);
}

// End-of-run material bonus based on performance.
// More rooms cleared, acts reached, and bosses killed = more materials.
export function getEndOfRunMaterials(roomsEncountered: number, currentAct: number): MaterialInventory {
  return {
    wood: roomsEncountered * 2,
    iron: roomsEncountered + Math.floor(roomsEncountered * 1.5),
    herbs: roomsEncountered,
    food: Math.floor(roomsEncountered * 1.5),
    crystal: currentAct - 1 + Math.floor(roomsEncountered / 4),
  };
}
