import {
  getOfferableCardPool,
  getStandardPotionPool,
  selectRewardCards,
  trinketLibrary,
  type BattleCard,
  type TrinketEntry,
} from "@/lib/game-data";
import type {
  PersistedAlchemistState,
  PersistedEquipmentShopState,
  PersistedShopState,
  PersistedTrinketShopState,
} from "@/lib/active-run-session";
import {
  SHOP_CARDS_OFFERED,
  SHOP_REFRESHES,
  ALCHEMIST_POTIONS_OFFERED,
  ALCHEMIST_REFRESHES,
  TRINKET_SHOP_OFFERED,
  TRINKET_SHOP_REFRESHES,
  EQUIPMENT_SHOP_OFFERED,
  EQUIPMENT_SHOP_REFRESHES,
} from "@/lib/game-constants";
import { generateGearRewardChoices, type GearInstance } from "@/lib/gear";
import { sampleItems } from "@/features/alchemy/shared/utils";

export type BaseShopState<TItem> = {
  items: TItem[];
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
};

export type ShopState = BaseShopState<BattleCard> & {
  cards: BattleCard[];
  removeUsed: boolean;
};

export type AlchemistState = BaseShopState<BattleCard> & {
  potions: BattleCard[];
  mixUsed: boolean;
};

export type TrinketShopState = BaseShopState<TrinketEntry> & {
  trinkets: TrinketEntry[];
};

export type EquipmentShopState = BaseShopState<GearInstance> & {
  gear: GearInstance[];
};

export function createInitialShopState(deck: BattleCard[] = []): ShopState {
  const cards = selectRewardCards(deck, getOfferableCardPool(), SHOP_CARDS_OFFERED);
  return {
    items: cards,
    cards,
    refreshesLeft: SHOP_REFRESHES,
    removeUsed: false,
    firstPurchaseUsed: false,
    purchasedSlotKeys: [],
  };
}

export function createInitialAlchemistState(deck: BattleCard[] = []): AlchemistState {
  const potions = selectRewardCards(deck, getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED);
  return {
    items: potions,
    potions,
    refreshesLeft: ALCHEMIST_REFRESHES,
    mixUsed: false,
    firstPurchaseUsed: false,
    purchasedSlotKeys: [],
  };
}

export function createInitialTrinketShopState(rng: () => number = Math.random): TrinketShopState {
  const trinkets = sampleItems(trinketLibrary, TRINKET_SHOP_OFFERED, rng);
  return {
    items: trinkets,
    trinkets,
    refreshesLeft: TRINKET_SHOP_REFRESHES,
    firstPurchaseUsed: false,
    purchasedSlotKeys: [],
  };
}

export function createInitialEquipmentShopState(
  rng: () => number = Math.random,
  gearAstralChanceBonus = 0,
): EquipmentShopState {
  const gear = generateGearRewardChoices(EQUIPMENT_SHOP_OFFERED, rng, { astralChanceBonus: gearAstralChanceBonus });
  return {
    items: gear,
    gear,
    refreshesLeft: EQUIPMENT_SHOP_REFRESHES,
    firstPurchaseUsed: false,
    purchasedSlotKeys: [],
  };
}

export function resampleTrinketShopOfferings(rng: () => number = Math.random): TrinketEntry[] {
  return sampleItems(trinketLibrary, TRINKET_SHOP_OFFERED, rng);
}

export function resampleEquipmentShopOfferings(
  rng: () => number = Math.random,
  gearAstralChanceBonus = 0,
): GearInstance[] {
  return generateGearRewardChoices(EQUIPMENT_SHOP_OFFERED, rng, { astralChanceBonus: gearAstralChanceBonus });
}

export function serializeShopState(state: ShopState): PersistedShopState {
  return {
    cards: state.cards,
    removeUsed: state.removeUsed,
    refreshesLeft: state.refreshesLeft,
    firstPurchaseUsed: state.firstPurchaseUsed,
    purchasedSlotKeys: state.purchasedSlotKeys,
  };
}

export function hydrateShopState(data: PersistedShopState): ShopState {
  return {
    cards: data.cards,
    items: data.cards,
    removeUsed: data.removeUsed,
    refreshesLeft: data.refreshesLeft,
    firstPurchaseUsed: data.firstPurchaseUsed,
    purchasedSlotKeys: data.purchasedSlotKeys ?? [],
  };
}

export function serializeAlchemistState(state: AlchemistState): PersistedAlchemistState {
  return {
    potions: state.potions,
    mixUsed: state.mixUsed,
    refreshesLeft: state.refreshesLeft,
    firstPurchaseUsed: state.firstPurchaseUsed,
    purchasedSlotKeys: state.purchasedSlotKeys,
  };
}

export function hydrateAlchemistState(data: PersistedAlchemistState): AlchemistState {
  return {
    potions: data.potions,
    items: data.potions,
    mixUsed: data.mixUsed,
    refreshesLeft: data.refreshesLeft,
    firstPurchaseUsed: data.firstPurchaseUsed,
    purchasedSlotKeys: data.purchasedSlotKeys ?? [],
  };
}

export function serializeTrinketShopState(state: TrinketShopState): PersistedTrinketShopState {
  return {
    trinketIds: state.trinkets.map((trinket) => trinket.id),
    refreshesLeft: state.refreshesLeft,
    firstPurchaseUsed: state.firstPurchaseUsed,
    purchasedSlotKeys: state.purchasedSlotKeys,
  };
}

export function hydrateTrinketShopState(data: PersistedTrinketShopState): TrinketShopState {
  const trinkets = data.trinketIds.flatMap((id) => {
    const trinket = trinketLibrary.find((entry) => entry.id === id);
    return trinket ? [trinket] : [];
  });
  return {
    trinkets,
    items: trinkets,
    refreshesLeft: data.refreshesLeft,
    firstPurchaseUsed: data.firstPurchaseUsed,
    purchasedSlotKeys: data.purchasedSlotKeys ?? [],
  };
}

export function serializeEquipmentShopState(state: EquipmentShopState): PersistedEquipmentShopState {
  return {
    gear: state.gear,
    refreshesLeft: state.refreshesLeft,
    firstPurchaseUsed: state.firstPurchaseUsed,
    purchasedSlotKeys: state.purchasedSlotKeys,
  };
}

export function hydrateEquipmentShopState(data: PersistedEquipmentShopState): EquipmentShopState {
  return {
    gear: data.gear,
    items: data.gear,
    refreshesLeft: data.refreshesLeft,
    firstPurchaseUsed: data.firstPurchaseUsed,
    purchasedSlotKeys: data.purchasedSlotKeys ?? [],
  };
}
