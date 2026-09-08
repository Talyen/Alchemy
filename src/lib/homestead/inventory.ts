import type { MaterialId, MaterialInventory } from "./types";

export function materialAmount(inventory: Partial<MaterialInventory> | undefined, materialId: MaterialId): number {
  return inventory?.[materialId] ?? 0;
}

export function emptyInventory(): MaterialInventory {
  return { wood: 0, iron: 0, herbs: 0, food: 0, gems: 0 };
}

export function addInventory(a: MaterialInventory, b: MaterialInventory): MaterialInventory {
  return {
    wood: (a.wood ?? 0) + (b.wood ?? 0),
    iron: (a.iron ?? 0) + (b.iron ?? 0),
    herbs: (a.herbs ?? 0) + (b.herbs ?? 0),
    food: (a.food ?? 0) + (b.food ?? 0),
    gems: (a.gems ?? 0) + (b.gems ?? 0),
  };
}

export function canAfford(inventory: MaterialInventory, cost: MaterialInventory): boolean {
  return (
    (inventory.wood ?? 0) >= (cost.wood ?? 0) &&
    (inventory.iron ?? 0) >= (cost.iron ?? 0) &&
    (inventory.herbs ?? 0) >= (cost.herbs ?? 0) &&
    (inventory.food ?? 0) >= (cost.food ?? 0) &&
    (inventory.gems ?? 0) >= (cost.gems ?? 0)
  );
}

export function subtractInventory(inventory: MaterialInventory, cost: MaterialInventory): MaterialInventory {
  return {
    wood: Math.max(0, (inventory.wood ?? 0) - (cost.wood ?? 0)),
    iron: Math.max(0, (inventory.iron ?? 0) - (cost.iron ?? 0)),
    herbs: Math.max(0, (inventory.herbs ?? 0) - (cost.herbs ?? 0)),
    food: Math.max(0, (inventory.food ?? 0) - (cost.food ?? 0)),
    gems: Math.max(0, (inventory.gems ?? 0) - (cost.gems ?? 0)),
  };
}
