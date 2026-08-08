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
import { type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import {
  computeShopBuyPrice,
  computeShopRefreshPrice,
  computeShopServicePrice,
  getCardBuyTalentDiscounts,
  getGenericBuyTalentDiscounts,
} from "./shop-pricing";
import { getEquipmentShopPrice } from "./shop-gear-pricing";

export interface ShopBuyPriceContext {
  talentEffects: TalentEffectManifest;
  runTrinkets: string[];
  firstPurchaseUsed: boolean;
}

function computeBuyPrice(
  basePrice: number,
  discounts: { haggleDiscount: number; apothecaryDiscount: number },
  context: ShopBuyPriceContext,
): number {
  return computeShopBuyPrice({
    basePrice,
    ...discounts,
    merchantsFavorDiscount: computeTrinketManifest(context.runTrinkets).merchantsFavorDiscount,
    firstPurchaseUsed: context.firstPurchaseUsed,
  });
}

export function computeMerchantCardBuyPrice(card: BattleCard, context: ShopBuyPriceContext): number {
  return computeBuyPrice(SHOP_CARD_PRICE, getCardBuyTalentDiscounts(card, context.talentEffects), context);
}

export function computeAlchemistPotionBuyPrice(card: BattleCard, context: ShopBuyPriceContext): number {
  return computeBuyPrice(ALCHEMIST_POTION_PRICE, getCardBuyTalentDiscounts(card, context.talentEffects), context);
}

export function computeTrinketBuyPrice(context: ShopBuyPriceContext): number {
  return computeBuyPrice(TRINKET_SHOP_TRINKET_PRICE, getGenericBuyTalentDiscounts(context.talentEffects), context);
}

export function computeGearBuyPrice(instance: GearInstance, context: ShopBuyPriceContext): number {
  return computeBuyPrice(getEquipmentShopPrice(instance), getGenericBuyTalentDiscounts(context.talentEffects), context);
}

export function computeMerchantRefreshPrice(talentEffects: TalentEffectManifest, refreshesLeft: number): number {
  return computeShopRefreshPrice(SHOP_REFRESH_PRICE, talentEffects.shopFreeRefresh, refreshesLeft);
}

export function computeAlchemistRefreshPrice(talentEffects: TalentEffectManifest, refreshesLeft: number): number {
  return computeShopRefreshPrice(ALCHEMIST_REFRESH_PRICE, talentEffects.shopFreeRefresh, refreshesLeft);
}

export function computeRemoveCardPrice(talentEffects: TalentEffectManifest): number {
  return computeShopServicePrice(SHOP_REMOVE_PRICE, talentEffects.removeCardDiscount);
}

export function computeMixPotionPrice(talentEffects: TalentEffectManifest): number {
  return computeShopServicePrice(ALCHEMIST_MIX_PRICE, talentEffects.mixPotionDiscount);
}
