import { MATERIAL_IDS, type MaterialId, type MaterialInventory } from "./types";

export function materialAmount(inventory: Partial<MaterialInventory> | undefined, materialId: MaterialId): number {
  return inventory?.[materialId] ?? 0;
}

export function emptyInventory(): MaterialInventory {
  return { wood: 0, iron: 0, herbs: 0, food: 0, gems: 0 };
}

export function addInventory(a: MaterialInventory, b: MaterialInventory): MaterialInventory {
  const result = emptyInventory();
  for (const id of MATERIAL_IDS) {
    result[id] = (a[id] ?? 0) + (b[id] ?? 0);
  }
  return result;
}

export function canAfford(inventory: MaterialInventory, cost: MaterialInventory): boolean {
  return MATERIAL_IDS.every((id) => (inventory[id] ?? 0) >= (cost[id] ?? 0));
}

export function subtractInventory(inventory: MaterialInventory, cost: MaterialInventory): MaterialInventory {
  const result = emptyInventory();
  for (const id of MATERIAL_IDS) {
    result[id] = Math.max(0, (inventory[id] ?? 0) - (cost[id] ?? 0));
  }
  return result;
}
