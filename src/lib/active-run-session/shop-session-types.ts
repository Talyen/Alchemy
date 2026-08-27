// Runtime shop session types + empty factories. Serialize/hydrate live in shop-persistence.ts.
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import {
  SHOP_REFRESHES,
  ALCHEMIST_REFRESHES,
  TRINKET_SHOP_REFRESHES,
  EQUIPMENT_SHOP_REFRESHES,
} from "@/lib/game-constants";

export interface RefreshableShopFields {
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
}

export type ShopState = RefreshableShopFields & {
  cards: BattleCard[];
  removeUsed: boolean;
};

export type AlchemistState = RefreshableShopFields & {
  potions: BattleCard[];
  mixUsed: boolean;
};

export type TrinketShopState = RefreshableShopFields & {
  trinkets: TrinketEntry[];
};

export type EquipmentShopState = RefreshableShopFields & {
  gear: GearInstance[];
};

function emptyRefreshableFields(refreshesLeft: number): RefreshableShopFields {
  return {
    refreshesLeft,
    firstPurchaseUsed: false,
    purchasedSlotKeys: [],
  };
}

export function emptyShopState(): ShopState {
  return {
    cards: [],
    removeUsed: false,
    ...emptyRefreshableFields(SHOP_REFRESHES),
  };
}

export function emptyAlchemistState(): AlchemistState {
  return {
    potions: [],
    mixUsed: false,
    ...emptyRefreshableFields(ALCHEMIST_REFRESHES),
  };
}

export function emptyTrinketShopState(): TrinketShopState {
  return {
    trinkets: [],
    ...emptyRefreshableFields(TRINKET_SHOP_REFRESHES),
  };
}

export function emptyEquipmentShopState(): EquipmentShopState {
  return {
    gear: [],
    ...emptyRefreshableFields(EQUIPMENT_SHOP_REFRESHES),
  };
}
