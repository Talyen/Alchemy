import type { CharacterId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance, GearInventories, GearLoadouts, GearSlot } from "@/lib/gear";

export interface GearSaveFields {
  gearInventories: GearInventories;
  gearLoadouts: GearLoadouts;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
}

export interface GearStore {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  initialize: (
    inventories: GearInventories,
    loadouts: GearLoadouts,
    craftingCurrencies?: Partial<Record<CraftingCurrencyId, number>>,
  ) => void;
  addInstance: (instance: GearInstance, characterId: CharacterId) => void;
  equip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  unequip: (characterId: CharacterId, slot: GearSlot) => void;
  salvage: (
    instanceId: string,
    options?: { rng?: () => number },
  ) => { inventories: GearInventories; yieldedCurrencies: Record<CraftingCurrencyId, number> } | null;
  applyCurrency: (currencyId: CraftingCurrencyId, instanceId: string, options?: { rng?: () => number }) => boolean;
  addCurrencies: (currencies: Partial<Record<CraftingCurrencyId, number>>) => void;
  reset: () => void;
}
