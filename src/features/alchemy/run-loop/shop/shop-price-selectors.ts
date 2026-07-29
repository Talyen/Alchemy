import { computeTrinketManifest } from "@/lib/trinkets";
import {
  ALCHEMIST_MIX_PRICE,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  SHOP_CARD_PRICE,
  SHOP_REFRESH_PRICE,
  SHOP_REMOVE_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
} from "@/lib/game-constants";
import { type BattleCard, type TalentEffectManifest, type TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { readActiveRunStore, readRunSessionStore } from "@/features/alchemy/shared/stores/run-session-facade";
import {
  computeShopRefreshPrice,
  computeShopServicePrice,
  getCardBuyTalentDiscounts,
  getGenericBuyTalentDiscounts,
  makeBuyPriceGetter,
} from "./shop-pricing";
import { getEquipmentShopPrice } from "./shop-gear-pricing";

interface ShopPriceSelectorDeps {
  getTalentEffects: () => TalentEffectManifest;
}

export function createShopPriceSelectors({ getTalentEffects }: ShopPriceSelectorDeps) {
  const getMerchantsFavorDiscount = () =>
    computeTrinketManifest(readActiveRunStore().runTrinkets).merchantsFavorDiscount;

  const getMerchantCardBuyPrice = makeBuyPriceGetter<BattleCard>(
    () => SHOP_CARD_PRICE,
    (card) => getCardBuyTalentDiscounts(card, getTalentEffects()),
    () => readRunSessionStore().shopState.firstPurchaseUsed,
    getMerchantsFavorDiscount,
  );

  const getAlchemistPotionBuyPrice = makeBuyPriceGetter<BattleCard>(
    () => ALCHEMIST_POTION_PRICE,
    (card) => getCardBuyTalentDiscounts(card, getTalentEffects()),
    () => readRunSessionStore().alchemistState.firstPurchaseUsed,
    getMerchantsFavorDiscount,
  );

  const getTrinketBuyPrice = makeBuyPriceGetter<TrinketEntry>(
    () => TRINKET_SHOP_TRINKET_PRICE,
    () => getGenericBuyTalentDiscounts(getTalentEffects()),
    () => readRunSessionStore().trinketShopState.firstPurchaseUsed,
    getMerchantsFavorDiscount,
  );

  const getGearBuyPrice = makeBuyPriceGetter<GearInstance>(
    (instance) => getEquipmentShopPrice(instance),
    () => getGenericBuyTalentDiscounts(getTalentEffects()),
    () => readRunSessionStore().equipmentShopState.firstPurchaseUsed,
    getMerchantsFavorDiscount,
  );

  function getShopRefreshPrice(refreshesLeft: number): number {
    return computeShopRefreshPrice(SHOP_REFRESH_PRICE, getTalentEffects().shopFreeRefresh, refreshesLeft);
  }

  function getAlchemistRefreshPrice(refreshesLeft: number): number {
    return computeShopRefreshPrice(ALCHEMIST_REFRESH_PRICE, getTalentEffects().shopFreeRefresh, refreshesLeft);
  }

  function getRemoveCardPrice(): number {
    return computeShopServicePrice(SHOP_REMOVE_PRICE, getTalentEffects().removeCardDiscount);
  }

  function getMixPotionPrice(): number {
    return computeShopServicePrice(ALCHEMIST_MIX_PRICE, getTalentEffects().mixPotionDiscount);
  }

  const getTrinketRefreshPrice = getShopRefreshPrice;
  const getEquipmentRefreshPrice = getShopRefreshPrice;

  return {
    getMerchantCardBuyPrice,
    getAlchemistPotionBuyPrice,
    getTrinketBuyPrice,
    getGearBuyPrice,
    getShopRefreshPrice,
    getAlchemistRefreshPrice,
    getTrinketRefreshPrice,
    getEquipmentRefreshPrice,
    getRemoveCardPrice,
    getMixPotionPrice,
  };
}
