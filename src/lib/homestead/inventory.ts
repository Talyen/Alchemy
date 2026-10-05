import { MATERIAL_IDS, type MaterialInventory } from "./types";
import { createNumericManifest } from "@/lib/manifest-utils";

export const EMPTY_INVENTORY: Readonly<MaterialInventory> = Object.freeze(createNumericManifest(MATERIAL_IDS));

export function emptyInventory(): MaterialInventory {
  return { ...EMPTY_INVENTORY };
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
