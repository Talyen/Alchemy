import { getOfferableCardPool, getStandardPotionPool, selectRewardCards, type BattleCard } from "@/lib/game-data";
import {
  SHOP_CARDS_OFFERED,
  SHOP_REFRESHES,
  ALCHEMIST_POTIONS_OFFERED,
  ALCHEMIST_REFRESHES,
} from "@/lib/game-constants";

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

export function createInitialShopState(deck: BattleCard[] = []): ShopState {
  return {
    cards: selectRewardCards(deck, getOfferableCardPool(), SHOP_CARDS_OFFERED),
    refreshesLeft: SHOP_REFRESHES,
    removeUsed: false,
    firstPurchaseUsed: false,
  };
}

export function createInitialAlchemistState(deck: BattleCard[] = []): AlchemistState {
  return {
    potions: selectRewardCards(deck, getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED),
    refreshesLeft: ALCHEMIST_REFRESHES,
    mixUsed: false,
    firstPurchaseUsed: false,
  };
}
