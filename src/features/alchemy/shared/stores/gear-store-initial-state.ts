import { createEmptyGearInventories, createEmptyGearLoadouts, EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";

export const initialState = {
  inventories: createEmptyGearInventories(),
  loadouts: createEmptyGearLoadouts(),
  craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
};
