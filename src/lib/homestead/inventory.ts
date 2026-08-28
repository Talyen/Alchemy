import { MATERIAL_IDS, type MaterialId, type MaterialInventory } from "./types";

export function materialAmount(inventory: MaterialInventory, materialId: MaterialId): number {
  return (inventory as Partial<Record<MaterialId, number>>)[materialId] ?? 0;
}

export function emptyInventory(): MaterialInventory {
  return { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 };
}

export function addInventory(a: MaterialInventory, b: MaterialInventory): MaterialInventory {
  const result = { ...a };
  for (const mat of MATERIAL_IDS) {
    result[mat] = materialAmount(result, mat) + materialAmount(b, mat);
  }
  return result;
}

export function canAfford(inventory: MaterialInventory, cost: MaterialInventory): boolean {
  return MATERIAL_IDS.every((mat) => materialAmount(inventory, mat) >= materialAmount(cost, mat));
}

export function subtractInventory(inventory: MaterialInventory, cost: MaterialInventory): MaterialInventory {
  const result = { ...inventory };
  for (const mat of MATERIAL_IDS) {
    result[mat] = Math.max(0, materialAmount(result, mat) - materialAmount(cost, mat));
  }
  return result;
}
