import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { selectRewardCards, type BattleCard, type TrinketEntry } from "@/lib/game-data";
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
import {
  SHOP_CARDS_OFFERED,
  ALCHEMIST_POTIONS_OFFERED,
  TRINKET_SHOP_OFFERED,
  EQUIPMENT_SHOP_OFFERED,
} from "@/lib/game-constants";
import { generateGearRewardChoices, type GearInstance } from "@/lib/gear";
import { trinketLibrary } from "@/lib/game-data";
import { sampleItems } from "@/lib/utils";

export type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState };

export function resampleTrinketShopOfferings(rng: () => number, ownedIds: readonly string[] = []): TrinketEntry[] {
  const owned = new Set(ownedIds);
  return sampleItems(
    trinketLibrary.filter((entry) => !owned.has(entry.id)),
    TRINKET_SHOP_OFFERED,
    rng,
  );
}

export function resampleEquipmentShopOfferings(rng: () => number, gearAstralChanceBonus = 0): GearInstance[] {
  return generateGearRewardChoices(EQUIPMENT_SHOP_OFFERED, rng, gearAstralChanceBonus);
}

/** `firstPurchaseUsed` resets per visit (`empty*State`); Merchant's Favor is first purchase at each shop. */
export function createInitialShopState(deck: BattleCard[], rng: () => number): ShopState {
  return {
    ...emptyShopState(),
    cards: selectRewardCards(deck, getOfferableCardPool(), SHOP_CARDS_OFFERED, [], rng),
  };
}

export function createInitialAlchemistState(deck: BattleCard[], rng: () => number): AlchemistState {
  return {
    ...emptyAlchemistState(),
    potions: selectRewardCards(deck, getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED, [], rng),
  };
}

export function createInitialTrinketShopState(rng: () => number, ownedIds: readonly string[] = []): TrinketShopState {
  return {
    ...emptyTrinketShopState(),
    trinkets: resampleTrinketShopOfferings(rng, ownedIds),
  };
}

export function createInitialEquipmentShopState(rng: () => number, gearAstralChanceBonus = 0): EquipmentShopState {
  return {
    ...emptyEquipmentShopState(),
    gear: resampleEquipmentShopOfferings(rng, gearAstralChanceBonus),
  };
}
