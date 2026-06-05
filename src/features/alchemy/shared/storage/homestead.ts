// Homestead save migration helpers for material inventory and renamed content IDs.
// Depends on homestead persisted type contracts and save defaults.
import type { BuildingId, FarmId, MaterialInventory } from "@/lib/homestead/types";
import { defaultSaveData } from "./defaults";

// Rebuild key-by-key so saves from before a material existed receive a zero default while
// preserving any resources the player had already earned.
export function migrateMaterialInventory(inv: unknown): MaterialInventory {
  if (!inv || typeof inv !== "object") return defaultSaveData.materialInventory;
  const old = inv as Record<string, number>;
  return {
    wood: old.wood ?? 0,
    iron: old.iron ?? 0,
    herbs: old.herbs ?? 0,
    food: old.food ?? 0,
    crystal: old.crystal ?? 0,
  };
}

// Content IDs are part of persisted progress, so legacy names are remapped on load instead
// of forcing players to rebuild renamed structures.
export function migrateBuildingIds(ids: unknown): BuildingId[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => {
    if (id === "smithy") return "blacksmiths-forge" as BuildingId;
    return id as BuildingId;
  });
}

// Farm plots follow the same persisted-ID migration rule as buildings: renamed farm content
// should keep its planted/completed state across versions.
export function migrateFarmIds(ids: unknown): FarmId[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => {
    if (id === "sheep-pasture") return "pasture" as FarmId;
    return id as FarmId;
  });
}
