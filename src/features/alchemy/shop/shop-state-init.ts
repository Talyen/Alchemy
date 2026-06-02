import { cardLibrary, getStandardPotionPool, type BattleCard } from "@/lib/game-data";
import {
  SHOP_CARDS_OFFERED,
  SHOP_REFRESHES,
  ALCHEMIST_POTIONS_OFFERED,
  ALCHEMIST_REFRESHES,
} from "@/lib/game-constants";
import { sampleItems } from "@/features/alchemy/utils";

export type ShopState = {
  cards: BattleCard[];
  refreshesLeft: number;
  removeUsed: boolean;
  firstPurchaseUsed: boolean;
};

export type AlchemistState = {
  potions: BattleCard[];
  refreshesLeft: number;
  mixUsed: boolean;
  firstPurchaseUsed: boolean;
};

export function createInitialShopState(): ShopState {
  return {
    cards: sampleItems(cardLibrary, SHOP_CARDS_OFFERED),
    refreshesLeft: SHOP_REFRESHES,
    removeUsed: false,
    firstPurchaseUsed: false,
  };
}

export function createInitialAlchemistState(): AlchemistState {
  const potions = sampleItems(getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED);
  return {
    potions,
    refreshesLeft: ALCHEMIST_REFRESHES,
    mixUsed: false,
    firstPurchaseUsed: false,
  };
}
