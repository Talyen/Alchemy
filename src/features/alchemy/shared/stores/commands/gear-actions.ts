import type { CharacterId } from "@/lib/game-data";
import { isTrinketId } from "@/lib/game-data";
import type {
  CraftingCurrencyId,
  EquippedTrinkets,
  GearInstance,
  GearInventories,
  GearLoadouts,
  GearSlot,
} from "@/lib/gear";
import {
  addCraftingCurrencies,
  applyCraftingCurrency,
  EMPTY_CRAFTING_CURRENCIES,
  equipGear,
  findGearInventoryOwner,
  flattenGearInventories,
  GEAR_CHARACTER_IDS,
  normalizeCraftingCurrencies,
  normalizeEquippedTrinkets,
  pruneOrphanGearLoadouts,
  computeSalvageYield,
  unequipGear,
} from "@/lib/gear";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Draft } from "immer";
import type { GearStateFields } from "../session/gear-store-types";
import { createInitialGearState } from "../session/gear-state-defaults";
import { ownTransactionInput } from "../session/readonly-view";

export function initializeGear(
  gear: Draft<GearStateFields>,
  inventories: GearInventories,
  loadouts: GearLoadouts,
  craftingCurrencies: Partial<Record<CraftingCurrencyId, number>> = EMPTY_CRAFTING_CURRENCIES,
  ownedTrinketIds: string[] = [],
  equippedTrinkets?: EquippedTrinkets,
): void {
  gear.inventories = ownTransactionInput(inventories);
  // Dangling equipped IDs (e.g. from older saves) are pruned here as well as
  // in the save pipeline, so in-memory state never references missing items.
  gear.loadouts = pruneOrphanGearLoadouts(flattenGearInventories(inventories), loadouts);
  const owned = new Set<string>();
  for (const id of ownedTrinketIds) if (isTrinketId(id)) owned.add(id);
  gear.ownedTrinketIds = [...owned];
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
  gear.inventories[characterId].push(ownTransactionInput(instance));
}

export function equipGearInstance(
  gear: Draft<GearStateFields>,
  characterId: CharacterId,
  slot: GearSlot,
  instance: GearInstance,
): boolean {
  if (gear.loadouts[characterId]?.[slot] === instance.instanceId) return false;
  const flatInventory = flattenGearInventories(gear.inventories);
  const next = equipGear(gear.loadouts, characterId, slot, instance, flatInventory);
  if (next === gear.loadouts) return false;
  gear.loadouts = next;
  return true;
}

export function unequipGearInstance(gear: Draft<GearStateFields>, characterId: CharacterId, slot: GearSlot): boolean {
  const loadout = gear.loadouts[characterId];
  if (!loadout || loadout[slot] == null) return false;
  gear.loadouts = unequipGear(gear.loadouts, characterId, slot, flattenGearInventories(gear.inventories));
  return true;
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
  if (!gear.ownedTrinketIds.includes(trinketId) || gear.equippedTrinkets[characterId] === trinketId) return false;
  for (const id of GEAR_CHARACTER_IDS) {
    if (gear.equippedTrinkets[id] === trinketId) gear.equippedTrinkets[id] = null;
  }
  gear.equippedTrinkets[characterId] = trinketId;
  return true;
}

export function unequipPermanentTrinket(gear: Draft<GearStateFields>, characterId: CharacterId): boolean {
  if (gear.equippedTrinkets[characterId] === null) return false;
  gear.equippedTrinkets[characterId] = null;
  return true;
}

export function salvageGearInstance(
  gear: Draft<GearStateFields>,
  instanceId: string,
): {
  yieldedCurrencies: Record<CraftingCurrencyId, number>;
  yieldedMaterials: MaterialInventory;
} | null {
  // Materials routing lives OUTSIDE this helper: only
  // salvageGearInTransaction grants yieldedMaterials (during a run)
  // or stockpiles them (meta). Calling this directly never grants materials.
  const owner = findGearInventoryOwner(gear.inventories, instanceId);
  if (!owner) return null;
  // Yield is always recomputed authoritatively: the preview shown in the
  // confirm dialog is deterministic (seeded by instance ID), so preview and
  // payout agree without trusting a frozen client value.
  const inventory = gear.inventories[owner];
  const instance = inventory.find((item) => item.instanceId === instanceId);
  if (!instance) return null;
  const { currencies: yieldedCurrencies, materials: yieldedMaterials } = computeSalvageYield(instance);
  gear.inventories[owner] = inventory.filter((item) => item.instanceId !== instanceId);
  gear.loadouts = pruneOrphanGearLoadouts(flattenGearInventories(gear.inventories), gear.loadouts);
  gear.craftingCurrencies = addCraftingCurrencies(gear.craftingCurrencies, yieldedCurrencies);
  return { yieldedCurrencies, yieldedMaterials };
}

export function applyGearCurrency(
  gear: Draft<GearStateFields>,
  currencyId: CraftingCurrencyId,
  instanceId: string,
  options: { rng: () => number },
): boolean {
  if (!options?.rng) throw new Error("applyCurrency requires an explicit rng");
  const owner = findGearInventoryOwner(gear.inventories, instanceId);
  if (!owner) return false;
  const inventory = gear.inventories[owner];
  const index = inventory.findIndex((entry) => entry.instanceId === instanceId);
  const item = inventory[index];
  if (!item || (gear.craftingCurrencies[currencyId] ?? 0) < 1) return false;
  const updatedItem = applyCraftingCurrency(currencyId, item, options.rng);
  if (updatedItem === item) return false;
  inventory[index] = updatedItem;
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
  Object.assign(gear, createInitialGearState());
}
