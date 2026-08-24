import {
  createEmptyEquippedTrinkets,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
} from "@/lib/gear";

export const initialState = {
  inventories: createEmptyGearInventories(),
  loadouts: createEmptyGearLoadouts(),
  ownedTrinketIds: [],
  equippedTrinkets: createEmptyEquippedTrinkets(),
  craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
};
