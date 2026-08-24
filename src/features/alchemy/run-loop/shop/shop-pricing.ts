// Shop price calculations, gear pricing, and price selectors.
import {
  ALCHEMIST_MIX_PRICE,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  EQUIPMENT_SHOP_ASTRAL_PRICE,
  EQUIPMENT_SHOP_BASIC_PRICE,
  SHOP_CARD_PRICE,
  SHOP_REFRESH_PRICE,
  SHOP_REMOVE_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
} from "@/lib/game-constants";
import { type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import { isStandardPotionCard } from "@/lib/game-data/cards/card-pools";
import { gearDefinitions, type GearInstance } from "@/lib/gear";
import { computeTrinketManifest } from "@/lib/trinkets";

export interface ShopBuyPriceInput {
  basePrice: number;
  haggleDiscount: number;
  apothecaryDiscount?: number;
  merchantsFavorDiscount?: number;
  firstPurchaseUsed: boolean;
}

export interface ShopBuyPriceContext {
  talentEffects: TalentEffectManifest;
  runBoons: string[];
  firstPurchaseUsed: boolean;
}

export function getEquipmentShopPrice(instance: GearInstance): number {
  const rarity = gearDefinitions[instance.definitionId]?.rarity;
  return rarity === "astral" ? EQUIPMENT_SHOP_ASTRAL_PRICE : EQUIPMENT_SHOP_BASIC_PRICE;
}

export function computeShopBuyPrice(input: ShopBuyPriceInput): number {
  const apothecary = input.apothecaryDiscount ?? 0;
  let price = Math.max(0, input.basePrice - input.haggleDiscount - apothecary);
  if (!input.firstPurchaseUsed) {
    price = Math.max(0, price - (input.merchantsFavorDiscount ?? 0));
  }
  return price;
}

export function computeShopServicePrice(basePrice: number, serviceDiscount = 0): number {
  return Math.max(0, basePrice - serviceDiscount);
}

export function computeShopRefreshPrice(basePrice: number, shopFreeRefresh: boolean, refreshesLeft: number): number {
  if (shopFreeRefresh && refreshesLeft > 0) return 0;
  return basePrice;
}

export function getCardBuyTalentDiscounts(
  card: BattleCard,
  talents: Pick<TalentEffectManifest, "shopCardDiscount" | "potionDiscount">,
): { haggleDiscount: number; apothecaryDiscount: number } {
  const haggleDiscount = talents.shopCardDiscount;
  const apothecaryDiscount = isStandardPotionCard(card) ? talents.potionDiscount : 0;
  return { haggleDiscount, apothecaryDiscount };
}

export function getGenericBuyTalentDiscounts(talents: Pick<TalentEffectManifest, "shopCardDiscount">): {
  haggleDiscount: number;
  apothecaryDiscount: number;
} {
  return { haggleDiscount: talents.shopCardDiscount, apothecaryDiscount: 0 };
}

function computeBuyPrice(
  basePrice: number,
  discounts: { haggleDiscount: number; apothecaryDiscount: number },
  context: ShopBuyPriceContext,
): number {
  return computeShopBuyPrice({
    basePrice,
    ...discounts,
    merchantsFavorDiscount: computeTrinketManifest(context.runBoons).merchantsFavorDiscount,
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
