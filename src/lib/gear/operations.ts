import { computeSalvageYield } from "./crafting";
import { pruneOrphanGearLoadouts } from "./loadout-operations";
import type { GearInstance, GearLoadouts } from "./types";

export function salvageGear(inventory: GearInstance[], loadouts: GearLoadouts, instanceId: string) {
  const instance = inventory.find((item) => item.instanceId === instanceId);
  if (!instance) return null;
  const salvageYield = computeSalvageYield(instance);
  const nextInventory = inventory.filter((item) => item.instanceId !== instanceId);
  return {
    inventory: nextInventory,
    loadouts: pruneOrphanGearLoadouts(nextInventory, loadouts),
    yieldedCurrencies: salvageYield.currencies,
    yieldedMaterials: salvageYield.materials,
  };
}
