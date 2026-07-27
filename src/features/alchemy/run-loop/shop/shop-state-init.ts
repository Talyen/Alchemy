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
import { sampleItems } from "@/features/alchemy/shared/utils";

export type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState };

export {
  serializeTrinketShopState,
  hydrateTrinketShopState,
  serializeEquipmentShopState,
  hydrateEquipmentShopState,
} from "@/lib/active-run-session";

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
