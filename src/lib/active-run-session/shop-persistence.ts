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
  type ShopState,
  type TrinketShopState,
} from "./shop-session-types";
import { lookupTrinketEntries } from "./pending-reward-persistence";

interface RefreshableShopFields {
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
}

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
  return hydrateRefreshableShopState(data, { trinkets: lookupTrinketEntries(data.trinketIds) });
}

export function serializeEquipmentShopState(state: EquipmentShopState): PersistedEquipmentShopState {
  return {
    gear: state.gear,
    ...serializeRefreshableFields(state),
  };
}

export function hydrateEquipmentShopState(data: PersistedEquipmentShopState): EquipmentShopState {
  return hydrateRefreshableShopState(data, { gear: data.gear });
}
