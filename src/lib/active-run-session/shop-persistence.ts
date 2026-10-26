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
import { isTrinketId, trinketById } from "@/lib/game-data";
import { gearDefinitions } from "@/lib/gear/definitions";
import { repairShopOfferings } from "./shop-offering-repair";

function hydrateRefreshableFields(
  data: RefreshableShopFields,
  purchasedSlotKeys = data.purchasedSlotKeys ?? [],
): RefreshableShopFields {
  return {
    refreshesLeft: data.refreshesLeft,
    freeRefreshUsed: data.freeRefreshUsed ?? false,
    firstPurchaseUsed: data.firstPurchaseUsed,
    purchasedSlotKeys,
  };
}

export function hydrateShopState(data: PersistedShopState): ShopState {
  return {
    cards: data.cards,
    removeUsed: data.removeUsed,
    ...hydrateRefreshableFields(data),
  };
}

export function hydrateAlchemistState(data: PersistedAlchemistState): AlchemistState {
  return {
    potions: data.potions,
    brewOffers: data.brewOffers ?? [],
    brewUsed: data.brewUsed ?? false,
    mixUsed: data.mixUsed,
    distillUsed: data.distillUsed ?? false,
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
  const repaired = repairShopOfferings(data.trinketIds, data.purchasedSlotKeys ?? [], isTrinketId);
  return {
    trinkets: repaired.items.map((id) => trinketById[id]!),
    ...hydrateRefreshableFields(data, repaired.purchasedSlotKeys),
  };
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
    ...hydrateRefreshableFields(data, repaired.purchasedSlotKeys),
  };
}
