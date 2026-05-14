// Material inventory math: empty, add, canAfford, subtract. All functions handle
// missing keys by treating them as 0. subtractInventory clamps to 0.
import { MATERIAL_IDS, type MaterialInventory } from "./types";

export function emptyInventory(): MaterialInventory {
  return { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 };
}

export function addInventory(a: MaterialInventory, b: MaterialInventory): MaterialInventory {
  const result = { ...a };
  for (const mat of MATERIAL_IDS) {
    result[mat] = (result[mat] ?? 0) + (b[mat] ?? 0);
  }
  return result;
}

export function canAfford(inventory: MaterialInventory, cost: MaterialInventory): boolean {
  return MATERIAL_IDS.every((mat) => (inventory[mat] ?? 0) >= (cost[mat] ?? 0));
}

export function subtractInventory(inventory: MaterialInventory, cost: MaterialInventory): MaterialInventory {
  const result = { ...inventory };
  for (const mat of MATERIAL_IDS) {
    result[mat] = Math.max(0, (result[mat] ?? 0) - (cost[mat] ?? 0));
  }
  return result;
}
