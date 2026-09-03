import {
  createEmptyEquippedTrinkets,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
} from "@/lib/gear";
import type { GearStateFields } from "./gear-store-types";

export function createInitialGearState(): GearStateFields {
  return {
    inventories: createEmptyGearInventories(),
    loadouts: createEmptyGearLoadouts(),
    ownedTrinketIds: [],
    equippedTrinkets: createEmptyEquippedTrinkets(),
    craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
  };
}
