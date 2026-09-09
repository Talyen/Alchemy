import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { LABYRINTH_MODIFIER_CONFIG } from "@/lib/game-constants";
import {
  ALCHEMIST_MIX_PRICE,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  EQUIPMENT_SHOP_ASTRAL_PRICE,
  EQUIPMENT_SHOP_BASIC_PRICE,
  EQUIPMENT_SHOP_UNIQUE_PRICE,
  SHOP_CARD_PRICE,
  SHOP_REFRESH_PRICE,
  SHOP_REMOVE_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
} from "@/lib/game-constants";
import { type BattleCard, type TalentEffectManifest, type TrinketEntry } from "@/lib/game-data";
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

export type ShopBuyKind = "merchantCard" | "alchemistPotion" | "trinket" | "gear";

export type ShopRefreshKind = "merchant" | "alchemist" | "trinket" | "equipment";

export interface ShopBuyPriceContext {
  modifiers?: readonly EncounterRewardTraitId[];
  talentEffects: TalentEffectManifest;
  runBoons: string[];
  firstPurchaseUsed: boolean;
}

export function getEquipmentShopPrice(instance: GearInstance): number {
  const rarity = gearDefinitions[instance.definitionId]?.rarity;
  if (rarity === "unique") return EQUIPMENT_SHOP_UNIQUE_PRICE;
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

const SHOP_BUY_BASE_PRICE = {
  merchantCard: SHOP_CARD_PRICE,
  alchemistPotion: ALCHEMIST_POTION_PRICE,
  trinket: TRINKET_SHOP_TRINKET_PRICE,
} as const;

function getBuyMultiplier(
  kind: ShopBuyKind,
  item: BattleCard | GearInstance | TrinketEntry | null,
  modifiers: readonly EncounterRewardTraitId[],
): number {
  if (kind === "merchantCard" && modifiers.includes("bargain-bin")) return LABYRINTH_MODIFIER_CONFIG.half;
  if (kind === "alchemistPotion" && modifiers.includes("happy-hour")) return LABYRINTH_MODIFIER_CONFIG.half;
  if (kind === "trinket" && modifiers.includes("collectors-favor"))
    return LABYRINTH_MODIFIER_CONFIG.trinketPriceMultiplier;
  if (
    kind === "gear" &&
    modifiers.includes("apprentice") &&
    item !== null &&
    "definitionId" in item &&
    gearDefinitions[item.definitionId]?.rarity === "basic"
  )
    return LABYRINTH_MODIFIER_CONFIG.half;
  return 1;
}

function getBuyBasePrice(kind: ShopBuyKind, item: BattleCard | GearInstance | TrinketEntry | null): number {
  if (kind === "gear") return getEquipmentShopPrice(item as GearInstance);
  return SHOP_BUY_BASE_PRICE[kind];
}

function getBuyDiscounts(
  kind: ShopBuyKind,
  item: BattleCard | GearInstance | TrinketEntry | null,
  talentEffects: TalentEffectManifest,
): { haggleDiscount: number; apothecaryDiscount: number } {
  if ((kind === "merchantCard" || kind === "alchemistPotion") && item !== null)
    return getCardBuyTalentDiscounts(item as BattleCard, talentEffects);
  return getGenericBuyTalentDiscounts(talentEffects);
}

export function getShopBuyPrice(
  kind: ShopBuyKind,
  item: BattleCard | GearInstance | TrinketEntry | null,
  context: ShopBuyPriceContext,
): number {
  return computeBuyPrice(
    Math.round(getBuyBasePrice(kind, item) * getBuyMultiplier(kind, item, context.modifiers ?? [])),
    getBuyDiscounts(kind, item, context.talentEffects),
    context,
  );
}

export function getShopBuyPrices(
  kind: ShopBuyKind,
  items: ReadonlyArray<BattleCard | GearInstance | TrinketEntry>,
  context: ShopBuyPriceContext,
): number[] {
  return items.map((item) => getShopBuyPrice(kind, item, context));
}

const SHOP_REFRESH_BASE_PRICE: Record<ShopRefreshKind, number> = {
  merchant: SHOP_REFRESH_PRICE,
  trinket: SHOP_REFRESH_PRICE,
  equipment: SHOP_REFRESH_PRICE,
  alchemist: ALCHEMIST_REFRESH_PRICE,
};

const SHOP_REFRESH_FREE_TRAIT: Record<ShopRefreshKind, EncounterRewardTraitId | null> = {
  merchant: null,
  equipment: null,
  trinket: "fresh-curios",
  alchemist: "fresh-batch",
};

export function getShopRefreshPrice(
  kind: ShopRefreshKind,
  talentEffects: TalentEffectManifest,
  refreshesLeft: number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): number {
  const freeTrait = SHOP_REFRESH_FREE_TRAIT[kind];
  if (refreshesLeft > 0 && freeTrait !== null && modifiers.includes(freeTrait)) return 0;
  return computeShopRefreshPrice(SHOP_REFRESH_BASE_PRICE[kind], talentEffects.shopFreeRefresh, refreshesLeft);
}

export function computeMerchantRefreshPrice(talentEffects: TalentEffectManifest, refreshesLeft: number): number {
  return getShopRefreshPrice("merchant", talentEffects, refreshesLeft);
}

export function computeTrinketRefreshPrice(
  talentEffects: TalentEffectManifest,
  refreshesLeft: number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): number {
  return getShopRefreshPrice("trinket", talentEffects, refreshesLeft, modifiers);
}

export function computeEquipmentRefreshPrice(talentEffects: TalentEffectManifest, refreshesLeft: number): number {
  return getShopRefreshPrice("equipment", talentEffects, refreshesLeft);
}

export function computeAlchemistRefreshPrice(
  talentEffects: TalentEffectManifest,
  refreshesLeft: number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): number {
  return getShopRefreshPrice("alchemist", talentEffects, refreshesLeft, modifiers);
}

export function computeRemoveCardPrice(
  talentEffects: TalentEffectManifest,
  modifiers: readonly EncounterRewardTraitId[] = [],
): number {
  if (modifiers.includes("clean-slate")) return 0;
  return computeShopServicePrice(SHOP_REMOVE_PRICE, talentEffects.removeCardDiscount);
}

export function computeMixPotionPrice(
  talentEffects: TalentEffectManifest,
  modifiers: readonly EncounterRewardTraitId[] = [],
): number {
  if (modifiers.includes("open-kitchen")) return 0;
  return computeShopServicePrice(ALCHEMIST_MIX_PRICE, talentEffects.mixPotionDiscount);
}
