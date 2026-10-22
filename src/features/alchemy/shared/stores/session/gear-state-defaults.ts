import {
  createEmptyEquippedTrinkets,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
} from "@/lib/gear";
import type { GearSaveFields, GearStateFields } from "./gear-store-types";

export function createInitialGearState(): GearStateFields {
  return {
    inventories: createEmptyGearInventories(),
    loadouts: createEmptyGearLoadouts(),
    ownedTrinketIds: [],
    equippedTrinkets: createEmptyEquippedTrinkets(),
    craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
  };
}

export function createDefaultGearSaveFields(): GearSaveFields {
  const initial = createInitialGearState();
  return {
    gearInventories: initial.inventories,
    gearLoadouts: initial.loadouts,
    ownedTrinketIds: initial.ownedTrinketIds,
    equippedTrinkets: initial.equippedTrinkets,
    craftingCurrencies: initial.craftingCurrencies,
  };
}
