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
  GEAR_CHARACTER_IDS,
  normalizeEquippedTrinkets,
} from "@/lib/gear";
import type {
  CraftingCurrencyId,
  GearInstance,
  GearInventories,
  GearLoadouts,
  GearSlot,
  EquippedTrinkets,
  SalvageYield,
} from "@/lib/gear";
import type { CharacterId } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Draft } from "immer";
import { initialState } from "./gear-store-initial-state";
import type { GearStateFields } from "./gear-store-types";
import { isTrinketId } from "@/lib/game-data";

export function initializeGear(
  gear: Draft<GearStateFields>,
  inventories: GearInventories,
  loadouts: GearLoadouts,
  craftingCurrencies: Partial<Record<CraftingCurrencyId, number>> = EMPTY_CRAFTING_CURRENCIES,
  ownedTrinketIds: string[] = [],
  equippedTrinkets?: EquippedTrinkets,
): void {
  gear.inventories = inventories;
  gear.loadouts = loadouts;
  gear.ownedTrinketIds = [...new Set(ownedTrinketIds.filter(isTrinketId))];
  const owned = new Set(gear.ownedTrinketIds);
  const normalized = normalizeEquippedTrinkets(equippedTrinkets);
  const seen = new Set<string>();
  for (const characterId of GEAR_CHARACTER_IDS) {
    const id = normalized[characterId];
    if (!id || !owned.has(id) || seen.has(id)) normalized[characterId] = null;
    else seen.add(id);
  }
  gear.equippedTrinkets = normalized;
  gear.craftingCurrencies = normalizeCraftingCurrencies(craftingCurrencies);
}

export function addGearInstance(gear: Draft<GearStateFields>, instance: GearInstance, characterId: CharacterId): void {
  gear.inventories = {
    ...gear.inventories,
    [characterId]: [...(gear.inventories[characterId] ?? []), instance],
  };
}

export function equipGearInstance(
  gear: Draft<GearStateFields>,
  characterId: CharacterId,
  slot: GearSlot,
  instance: GearInstance,
): void {
  const flatInventory = flattenGearInventories(gear.inventories);
  gear.loadouts = equipGear(gear.loadouts, characterId, slot, instance, flatInventory);
}

export function unequipGearInstance(gear: Draft<GearStateFields>, characterId: CharacterId, slot: GearSlot): void {
  gear.loadouts = unequipGear(gear.loadouts, characterId, slot);
}

export function addPermanentTrinket(gear: Draft<GearStateFields>, trinketId: string): boolean {
  if (!isTrinketId(trinketId) || gear.ownedTrinketIds.includes(trinketId)) return false;
  gear.ownedTrinketIds.push(trinketId);
  return true;
}

export function equipPermanentTrinket(
  gear: Draft<GearStateFields>,
  characterId: CharacterId,
  trinketId: string,
): boolean {
  if (!gear.ownedTrinketIds.includes(trinketId)) return false;
  for (const id of GEAR_CHARACTER_IDS) {
    if (gear.equippedTrinkets[id] === trinketId) gear.equippedTrinkets[id] = null;
  }
  gear.equippedTrinkets[characterId] = trinketId;
  return true;
}

export function unequipPermanentTrinket(gear: Draft<GearStateFields>, characterId: CharacterId): void {
  gear.equippedTrinkets[characterId] = null;
}

export function salvageGearInstance(
  gear: Draft<GearStateFields>,
  instanceId: string,
  options?: { rng?: () => number; yield?: SalvageYield },
): {
  inventories: GearInventories;
  yieldedCurrencies: Record<CraftingCurrencyId, number>;
  yieldedMaterials: MaterialInventory;
} | null {
  const owner = findGearInventoryOwner(gear.inventories, instanceId);
  if (!owner) return null;
  if (!options?.yield && !options?.rng) throw new Error("salvage requires an explicit rng or yield");
  const result = salvageGear(
    flattenGearInventories(gear.inventories),
    gear.loadouts,
    instanceId,
    options.rng ?? (() => 0),
    options.yield,
  );
  if (!result) return null;
  gear.inventories = {
    ...gear.inventories,
    [owner]: gear.inventories[owner].filter((item) => item.instanceId !== instanceId),
  };
  gear.loadouts = result.loadouts;
  gear.craftingCurrencies = addCraftingCurrencies(gear.craftingCurrencies, result.yieldedCurrencies);
  return {
    inventories: gear.inventories,
    yieldedCurrencies: result.yieldedCurrencies,
    yieldedMaterials: result.yieldedMaterials,
  };
}

export function applyGearCurrency(
  gear: Draft<GearStateFields>,
  currencyId: CraftingCurrencyId,
  instanceId: string,
  options?: { rng?: () => number },
): boolean {
  const owner = findGearInventoryOwner(gear.inventories, instanceId);
  if (!owner) return false;
  const item = gear.inventories[owner].find((entry) => entry.instanceId === instanceId);
  if (!item || (gear.craftingCurrencies[currencyId] ?? 0) < 1 || !canApplyCraftingCurrency(currencyId, item))
    return false;
  if (!options?.rng) throw new Error("applyCurrency requires an explicit rng");
  const updatedItem = applyCraftingCurrency(currencyId, item, options.rng);
  if (updatedItem === item) return false;
  gear.inventories = {
    ...gear.inventories,
    [owner]: gear.inventories[owner].map((entry) => (entry.instanceId === instanceId ? updatedItem : entry)),
  };
  gear.craftingCurrencies = normalizeCraftingCurrencies({
    ...gear.craftingCurrencies,
    [currencyId]: (gear.craftingCurrencies[currencyId] ?? 0) - 1,
  });
  return true;
}

export function addGearCurrencies(
  gear: Draft<GearStateFields>,
  currencies: Partial<Record<CraftingCurrencyId, number>>,
): void {
  gear.craftingCurrencies = addCraftingCurrencies(gear.craftingCurrencies, currencies);
}

export function resetGear(gear: Draft<GearStateFields>): void {
  Object.assign(gear, initialState, { craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES } });
}
