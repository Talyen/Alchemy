// Shared shop price computation for purchases, services, and refreshes.
import type { BattleCard } from "@/lib/game-data";
import { isStandardPotionCard } from "@/lib/game-data/cards/card-pools";
import type { TalentEffectManifest } from "@/lib/game-data/talent-effect-manifest";

export interface ShopBuyPriceInput {
  basePrice: number;
  haggleDiscount: number;
  apothecaryDiscount?: number;
  merchantsFavorDiscount?: number;
  firstPurchaseUsed: boolean;
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

export function makeBuyPriceGetter<Item>(
  getBasePrice: (item: Item) => number,
  getDiscounts: (item: Item) => { haggleDiscount: number; apothecaryDiscount: number },
  getFirstPurchaseUsed: () => boolean,
  merchantsFavorDiscount: number,
): (item: Item) => number {
  return (item) => {
    const base = getBasePrice(item);
    const { haggleDiscount, apothecaryDiscount } = getDiscounts(item);
    return computeShopBuyPrice({
      basePrice: base,
      haggleDiscount,
      apothecaryDiscount,
      merchantsFavorDiscount,
      firstPurchaseUsed: getFirstPurchaseUsed(),
    });
  };
}
