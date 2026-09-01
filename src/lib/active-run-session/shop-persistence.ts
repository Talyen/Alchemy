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
import { gearDefinitions } from "@/lib/gear/definitions";
import { lookupTrinketEntries } from "./pending-reward-persistence";
import { repairShopOfferings, shopItemSlotKey } from "./shop-offering-repair";

function hydrateRefreshableFields(data: RefreshableShopFields): RefreshableShopFields {
  return {
    refreshesLeft: data.refreshesLeft,
    firstPurchaseUsed: data.firstPurchaseUsed,
    purchasedSlotKeys: data.purchasedSlotKeys ?? [],
  };
}

function serializeRefreshable(state: RefreshableShopFields): RefreshableShopFields {
  return {
    refreshesLeft: state.refreshesLeft,
    firstPurchaseUsed: state.firstPurchaseUsed,
    purchasedSlotKeys: state.purchasedSlotKeys,
  };
}

export function serializeShopState(state: ShopState): PersistedShopState {
  return {
    cards: state.cards,
    removeUsed: state.removeUsed,
    ...serializeRefreshable(state),
  };
}

export function hydrateShopState(data: PersistedShopState): ShopState {
  return {
    cards: data.cards,
    removeUsed: data.removeUsed,
    ...hydrateRefreshableFields(data),
  };
}

export function serializeAlchemistState(state: AlchemistState): PersistedAlchemistState {
  return {
    potions: state.potions,
    mixUsed: state.mixUsed,
    ...serializeRefreshable(state),
  };
}

export function hydrateAlchemistState(data: PersistedAlchemistState): AlchemistState {
  return {
    potions: data.potions,
    mixUsed: data.mixUsed,
    ...hydrateRefreshableFields(data),
  };
}

export function serializeTrinketShopState(state: TrinketShopState): PersistedTrinketShopState {
  return {
    trinketIds: state.trinkets.map((trinket) => trinket.id),
    ...serializeRefreshable(state),
  };
}

export function hydrateTrinketShopState(data: PersistedTrinketShopState): TrinketShopState {
  const knownIds = new Set(lookupTrinketEntries(data.trinketIds).map((entry) => entry.id));
  const repaired = repairShopOfferings(
    data.trinketIds,
    data.purchasedSlotKeys ?? [],
    (id) => knownIds.has(id),
    shopItemSlotKey,
  );
  return {
    trinkets: lookupTrinketEntries(repaired.items),
    ...hydrateRefreshableFields({ ...data, purchasedSlotKeys: repaired.purchasedSlotKeys }),
  };
}

export function serializeEquipmentShopState(state: EquipmentShopState): PersistedEquipmentShopState {
  return {
    gear: state.gear,
    ...serializeRefreshable(state),
  };
}

export function hydrateEquipmentShopState(data: PersistedEquipmentShopState): EquipmentShopState {
  const repaired = repairShopOfferings(
    data.gear,
    data.purchasedSlotKeys ?? [],
    (instance) => gearDefinitions[instance.definitionId] != null,
    (instance) => instance.instanceId,
  );
  return {
    gear: repaired.items,
    ...hydrateRefreshableFields({ ...data, purchasedSlotKeys: repaired.purchasedSlotKeys }),
  };
}
