// Persist / hydrate shop session state for active-run snapshots.
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

type RefreshablePersistedFields = Pick<
  RefreshableShopFields,
  "refreshesLeft" | "firstPurchaseUsed" | "purchasedSlotKeys"
>;

function serializeRefreshableFields(state: RefreshableShopFields): RefreshablePersistedFields {
  return {
    refreshesLeft: state.refreshesLeft,
    firstPurchaseUsed: state.firstPurchaseUsed,
    purchasedSlotKeys: state.purchasedSlotKeys,
  };
}

function hydrateRefreshableFields(data: RefreshablePersistedFields): RefreshablePersistedFields {
  return {
    refreshesLeft: data.refreshesLeft,
    firstPurchaseUsed: data.firstPurchaseUsed,
    purchasedSlotKeys: data.purchasedSlotKeys ?? [],
  };
}

function hydrateRefreshableShopState<
  TState extends RefreshableShopFields,
  TPersisted extends RefreshablePersistedFields,
>(data: TPersisted, payload: Omit<TState, keyof RefreshableShopFields>): TState {
  return {
    ...payload,
    ...hydrateRefreshableFields(data),
  } as TState;
}

export function serializeShopState(state: ShopState): PersistedShopState {
  return {
    cards: state.cards,
    removeUsed: state.removeUsed,
    ...serializeRefreshableFields(state),
  };
}

export function hydrateShopState(data: PersistedShopState): ShopState {
  return hydrateRefreshableShopState(data, { cards: data.cards, removeUsed: data.removeUsed });
}

export function serializeAlchemistState(state: AlchemistState): PersistedAlchemistState {
  return {
    potions: state.potions,
    mixUsed: state.mixUsed,
    ...serializeRefreshableFields(state),
  };
}

export function hydrateAlchemistState(data: PersistedAlchemistState): AlchemistState {
  return hydrateRefreshableShopState(data, { potions: data.potions, mixUsed: data.mixUsed });
}

export function serializeTrinketShopState(state: TrinketShopState): PersistedTrinketShopState {
  return {
    trinketIds: state.trinkets.map((trinket) => trinket.id),
    ...serializeRefreshableFields(state),
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
  return hydrateRefreshableShopState(
    { ...data, purchasedSlotKeys: repaired.purchasedSlotKeys },
    { trinkets: lookupTrinketEntries(repaired.items) },
  );
}

export function serializeEquipmentShopState(state: EquipmentShopState): PersistedEquipmentShopState {
  return {
    gear: state.gear,
    ...serializeRefreshableFields(state),
  };
}

export function hydrateEquipmentShopState(data: PersistedEquipmentShopState): EquipmentShopState {
  // Zod preprocess drops unknown defs; hydrate still remaps so orphan purchase keys cannot linger.
  const repaired = repairShopOfferings(
    data.gear,
    data.purchasedSlotKeys ?? [],
    (instance) => gearDefinitions[instance.definitionId] != null,
    (instance) => instance.instanceId,
  );
  return hydrateRefreshableShopState(
    { ...data, purchasedSlotKeys: repaired.purchasedSlotKeys },
    { gear: repaired.items },
  );
}
