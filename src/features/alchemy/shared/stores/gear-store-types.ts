import type { CharacterId } from "@/lib/game-data";
import type {
  CraftingCurrencyId,
  GearInstance,
  GearInventories,
  GearLoadouts,
  GearSlot,
  EquippedTrinkets,
  SalvageYield,
} from "@/lib/gear";
import type { MaterialInventory } from "@/lib/homestead/types";

export interface GearSaveFields {
  gearInventories: GearInventories;
  gearLoadouts: GearLoadouts;
  ownedTrinketIds: string[];
  equippedTrinkets: EquippedTrinkets;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
}

export type GearStateFields = Pick<
  GearStore,
  "inventories" | "loadouts" | "ownedTrinketIds" | "equippedTrinkets" | "craftingCurrencies"
>;

export interface GearStore {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  ownedTrinketIds: string[];
  equippedTrinkets: EquippedTrinkets;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  initialize: (
    inventories: GearInventories,
    loadouts: GearLoadouts,
    craftingCurrencies?: Partial<Record<CraftingCurrencyId, number>>,
    ownedTrinketIds?: string[],
    equippedTrinkets?: EquippedTrinkets,
  ) => void;
  addInstance: (instance: GearInstance, characterId: CharacterId) => void;
  equip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => boolean;
  unequip: (characterId: CharacterId, slot: GearSlot) => boolean;
  addTrinket: (trinketId: string) => boolean;
  equipTrinket: (characterId: CharacterId, trinketId: string) => boolean;
  unequipTrinket: (characterId: CharacterId) => boolean;
  salvage: (
    instanceId: string,
    options?: { rng?: () => number; yield?: SalvageYield },
  ) => {
    inventories: GearInventories;
    yieldedCurrencies: Record<CraftingCurrencyId, number>;
    yieldedMaterials: MaterialInventory;
  } | null;
  applyCurrency: (currencyId: CraftingCurrencyId, instanceId: string, options?: { rng?: () => number }) => boolean;
  addCurrencies: (currencies: Partial<Record<CraftingCurrencyId, number>>) => void;
  reset: () => void;
}
