// Narrow read port over gear-store for run-loop / run-setup / shell lifecycle code.
// Mutations stay on gear-store / armory controller — this port is read-only snapshots.
import type { CharacterId } from "@/lib/game-data";
import { computeGearManifest, flattenGearInventories, type GearInstance, type GearLoadouts } from "@/lib/gear";
import { useGearStore } from "./gear-store";

export function readHasAnyOwnedGear(): boolean {
  return flattenGearInventories(useGearStore.getState().inventories).length > 0;
}

export function readFlattenedGearInventory(): GearInstance[] {
  return flattenGearInventories(useGearStore.getState().inventories);
}

export function readGearLoadouts(): GearLoadouts {
  return useGearStore.getState().loadouts;
}

/** Aggregate gear effects for a character at battle/run-start entry. */
export function readGearManifestForCharacter(characterId: CharacterId) {
  const { inventories, loadouts } = useGearStore.getState();
  return computeGearManifest(characterId, flattenGearInventories(inventories), loadouts);
}

export function readGearMaxHealthBonus(characterId: CharacterId): number {
  return readGearManifestForCharacter(characterId).maxHealth;
}
