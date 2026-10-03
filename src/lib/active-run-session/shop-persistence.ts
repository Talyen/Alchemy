import type {
  PersistedAlchemistState,
  PersistedEquipmentShopState,
  PersistedShopState,
  PersistedTrinketShopState,
} from "./types";
import {
  type AlchemistState,
  type EquipmentShopState,
  type RefreshableShopFields,
  type ShopState,
  type TrinketShopState,
} from "./shop-session-types";
import { trinketById, type TrinketEntry } from "@/lib/game-data";
import { gearDefinitions } from "@/lib/gear/definitions";
import { repairShopOfferings } from "./shop-offering-repair";

export function lookupTrinketEntries(ids: readonly string[]): TrinketEntry[] {
  return ids.flatMap((id) => {
    const entry = Object.hasOwn(trinketById, id) ? trinketById[id] : undefined;
    return entry ? [entry] : [];
  });
}

function hydrateRefreshableFields(data: RefreshableShopFields): RefreshableShopFields {
  return {
    refreshesLeft: data.refreshesLeft,
    freeRefreshUsed: data.freeRefreshUsed ?? false,
    firstPurchaseUsed: data.firstPurchaseUsed,
    purchasedSlotKeys: data.purchasedSlotKeys ?? [],
  };
}

export function serializeShopState(state: ShopState): PersistedShopState {
  return { ...state };
}

export function hydrateShopState(data: PersistedShopState): ShopState {
  return {
    cards: data.cards,
    removeUsed: data.removeUsed,
    ...hydrateRefreshableFields(data),
  };
}

export function serializeAlchemistState(state: AlchemistState): PersistedAlchemistState {
  return { ...state };
}

export function hydrateAlchemistState(data: PersistedAlchemistState): AlchemistState {
  return {
    potions: data.potions,
    mixUsed: data.mixUsed,
    ...hydrateRefreshableFields(data),
  };
}

export function serializeTrinketShopState(state: TrinketShopState): PersistedTrinketShopState {
  const { trinkets, ...rest } = state;
  return {
    ...rest,
    trinketIds: trinkets.map((trinket) => trinket.id),
  };
}

export function hydrateTrinketShopState(data: PersistedTrinketShopState): TrinketShopState {
  const repaired = repairShopOfferings(
    data.trinketIds,
    data.purchasedSlotKeys ?? [],
    (id) => Object.hasOwn(trinketById, id) && Boolean(trinketById[id]),
  );
  return {
    trinkets: lookupTrinketEntries(repaired.items),
    ...hydrateRefreshableFields({ ...data, purchasedSlotKeys: repaired.purchasedSlotKeys }),
  };
}

export function serializeEquipmentShopState(state: EquipmentShopState): PersistedEquipmentShopState {
  return { ...state };
}

export function hydrateEquipmentShopState(data: PersistedEquipmentShopState): EquipmentShopState {
  const repaired = repairShopOfferings(
    data.gear,
    data.purchasedSlotKeys ?? [],
    (instance) =>
      Object.hasOwn(gearDefinitions, instance.definitionId) && gearDefinitions[instance.definitionId] != null,
  );
  return {
    gear: repaired.items,
    ...hydrateRefreshableFields({ ...data, purchasedSlotKeys: repaired.purchasedSlotKeys }),
  };
}
