import {
  equipGear,
  flattenGearInventories,
  findGearInventoryOwner,
  salvageGear,
  unequipGear,
  canApplyCraftingCurrency,
  applyCraftingCurrency,
  addCraftingCurrencies,
  normalizeCraftingCurrencies,
  EMPTY_CRAFTING_CURRENCIES,
} from "@/lib/gear";
import type { GearStore } from "./gear-store-types";
import { initialState } from "./gear-store-initial-state";

export type GearStateFields = Pick<GearStore, "inventories" | "loadouts" | "craftingCurrencies">;
export type GearActions = Omit<GearStore, keyof GearStateFields>;

type SetState = (partial: Partial<GearStateFields> | ((state: GearStateFields) => unknown), replace?: boolean) => void;
type GetState = () => GearStateFields;

export function createGearActions(set: SetState, get: GetState): GearActions {
  return {
    initialize: (inventories, loadouts, craftingCurrencies = initialState.craftingCurrencies) => {
      set(() => ({
        inventories,
        loadouts,
        craftingCurrencies: normalizeCraftingCurrencies(craftingCurrencies),
      }));
    },
    addInstance: (instance, characterId) =>
      set((state) => ({
        inventories: {
          ...state.inventories,
          [characterId]: [...(state.inventories[characterId] ?? []), instance],
        },
      })),
    equip: (characterId, slot, instance) =>
      set((state) => {
        const flatInventory = flattenGearInventories(state.inventories);
        return {
          loadouts: equipGear(state.loadouts, characterId, slot, instance, flatInventory),
        };
      }),
    unequip: (characterId, slot) =>
      set((state) => ({
        loadouts: unequipGear(state.loadouts, characterId, slot),
      })),
    salvage: (instanceId, options) => {
      const state = get();
      const owner = findGearInventoryOwner(state.inventories, instanceId);
      if (!owner) return null;
      if (!options?.rng) throw new Error("salvage requires an explicit rng");
      const result = salvageGear(flattenGearInventories(state.inventories), state.loadouts, instanceId, options.rng);
      if (!result) return null;
      const nextInventories = {
        ...state.inventories,
        [owner]: state.inventories[owner].filter((item) => item.instanceId !== instanceId),
      };
      const nextCurrencies = addCraftingCurrencies(state.craftingCurrencies, result.yieldedCurrencies);
      set(() => ({
        inventories: nextInventories,
        loadouts: result.loadouts,
        craftingCurrencies: nextCurrencies,
      }));
      return { inventories: nextInventories, yieldedCurrencies: result.yieldedCurrencies };
    },
    applyCurrency: (currencyId, instanceId, options) => {
      const state = get();
      const owner = findGearInventoryOwner(state.inventories, instanceId);
      if (!owner) return false;
      const item = state.inventories[owner].find((entry) => entry.instanceId === instanceId);
      if (!item || (state.craftingCurrencies[currencyId] ?? 0) < 1 || !canApplyCraftingCurrency(currencyId, item))
        return false;
      if (!options?.rng) throw new Error("applyCurrency requires an explicit rng");
      const updatedItem = applyCraftingCurrency(currencyId, item, options.rng);
      if (updatedItem === item) return false;
      const nextInventories = {
        ...state.inventories,
        [owner]: state.inventories[owner].map((entry) => (entry.instanceId === instanceId ? updatedItem : entry)),
      };
      const nextCurrencies = normalizeCraftingCurrencies({
        ...state.craftingCurrencies,
        [currencyId]: (state.craftingCurrencies[currencyId] ?? 0) - 1,
      });
      set(() => ({
        inventories: nextInventories,
        craftingCurrencies: nextCurrencies,
      }));
      return true;
    },
    addCurrencies: (currencies) =>
      set((state) => ({
        craftingCurrencies: addCraftingCurrencies(state.craftingCurrencies, currencies),
      })),
    reset: () => set(() => ({ ...initialState, craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES } })),
  };
}
