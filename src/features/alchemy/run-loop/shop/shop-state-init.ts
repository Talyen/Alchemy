import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { selectRewardCards, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import type {
  PersistedAlchemistState,
  PersistedEquipmentShopState,
  PersistedShopState,
  PersistedTrinketShopState,
} from "@/lib/active-run-session";
import {
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
  type AlchemistState,
  type EquipmentShopState,
  type ShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import { lookupTrinketEntries } from "@/lib/active-run-session/pending-reward-persistence";
import {
  SHOP_CARDS_OFFERED,
  ALCHEMIST_POTIONS_OFFERED,
  TRINKET_SHOP_OFFERED,
  EQUIPMENT_SHOP_OFFERED,
} from "@/lib/game-constants";
import { generateGearRewardChoices, type GearInstance } from "@/lib/gear";
import { trinketLibrary } from "@/lib/game-data";
import { sampleItems } from "@/features/alchemy/shared/utils";

export type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState };
export { emptyAlchemistState, emptyEquipmentShopState, emptyShopState, emptyTrinketShopState };

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

export function resampleTrinketShopOfferings(rng: () => number = Math.random): TrinketEntry[] {
  return sampleItems(trinketLibrary, TRINKET_SHOP_OFFERED, rng);
}

export function resampleEquipmentShopOfferings(
  rng: () => number = Math.random,
  gearAstralChanceBonus = 0,
): GearInstance[] {
  return generateGearRewardChoices(EQUIPMENT_SHOP_OFFERED, rng, gearAstralChanceBonus);
}

export function createInitialShopState(deck: BattleCard[] = [], rng?: () => number): ShopState {
  return {
    ...emptyShopState(),
    cards: selectRewardCards(deck, getOfferableCardPool(), SHOP_CARDS_OFFERED, [], rng),
  };
}

export function createInitialAlchemistState(deck: BattleCard[] = [], rng?: () => number): AlchemistState {
  return {
    ...emptyAlchemistState(),
    potions: selectRewardCards(deck, getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED, [], rng),
  };
}

export function createInitialTrinketShopState(rng: () => number = Math.random): TrinketShopState {
  return {
    ...emptyTrinketShopState(),
    trinkets: resampleTrinketShopOfferings(rng),
  };
}

export function createInitialEquipmentShopState(
  rng: () => number = Math.random,
  gearAstralChanceBonus = 0,
): EquipmentShopState {
  return {
    ...emptyEquipmentShopState(),
    gear: resampleEquipmentShopOfferings(rng, gearAstralChanceBonus),
  };
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
