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
import { type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import { isStandardPotionCard } from "@/lib/game-data/cards/card-pools";
import { gearDefinitions, type GearInstance } from "@/lib/gear";
import { computeTrinketManifest } from "@/lib/trinkets";

export type ShopRefreshKind = "merchant" | "alchemist" | "trinket" | "equipment";

export interface ShopBuyPriceContext {
  modifiers?: readonly EncounterRewardTraitId[];
  talentEffects: TalentEffectManifest;
  runBoons: string[];
  firstPurchaseUsed: boolean;
}

type ShopBuyPriceArguments =
  | [kind: "merchantCard" | "alchemistPotion", item: BattleCard, context: ShopBuyPriceContext]
  | [kind: "gear", item: GearInstance, context: ShopBuyPriceContext]
  | [kind: "trinket", item: null, context: ShopBuyPriceContext];

export function getEquipmentShopPrice(instance: GearInstance): number {
  const rarity = gearDefinitions[instance.definitionId]?.rarity;
  if (rarity === "unique") return EQUIPMENT_SHOP_UNIQUE_PRICE;
  return rarity === "astral" ? EQUIPMENT_SHOP_ASTRAL_PRICE : EQUIPMENT_SHOP_BASIC_PRICE;
}

const SHOP_BUY_POLICY = {
  merchantCard: { basePrice: SHOP_CARD_PRICE, trait: "bargain-bin", multiplier: LABYRINTH_MODIFIER_CONFIG.half },
  alchemistPotion: {
    basePrice: ALCHEMIST_POTION_PRICE,
    trait: "happy-hour",
    multiplier: LABYRINTH_MODIFIER_CONFIG.half,
  },
  trinket: {
    basePrice: TRINKET_SHOP_TRINKET_PRICE,
    trait: "collectors-favor",
    multiplier: LABYRINTH_MODIFIER_CONFIG.trinketPriceMultiplier,
  },
} as const;

export function getShopBuyPrice(...args: ShopBuyPriceArguments): number {
  const [kind, item, context] = args;
  const { basePrice, trait, multiplier } =
    kind === "gear"
      ? {
          basePrice: getEquipmentShopPrice(item),
          trait: gearDefinitions[item.definitionId]?.rarity === "basic" ? ("apprentice" as const) : null,
          multiplier: LABYRINTH_MODIFIER_CONFIG.half,
        }
      : SHOP_BUY_POLICY[kind];
  const locationMultiplier = trait && context.modifiers?.includes(trait) ? multiplier : 1;
  const potionDiscount =
    (kind === "merchantCard" || kind === "alchemistPotion") && isStandardPotionCard(item)
      ? context.talentEffects.potionDiscount
      : 0;
  const price = Math.max(
    0,
    Math.round(basePrice * locationMultiplier) - context.talentEffects.shopCardDiscount - potionDiscount,
  );
  return context.firstPurchaseUsed
    ? price
    : Math.max(0, price - computeTrinketManifest(context.runBoons).merchantsFavorDiscount);
}

const SHOP_REFRESH_POLICY: Record<ShopRefreshKind, { basePrice: number; freeTrait: EncounterRewardTraitId | null }> = {
  merchant: { basePrice: SHOP_REFRESH_PRICE, freeTrait: null },
  equipment: { basePrice: SHOP_REFRESH_PRICE, freeTrait: null },
  trinket: { basePrice: SHOP_REFRESH_PRICE, freeTrait: "fresh-curios" },
  alchemist: { basePrice: ALCHEMIST_REFRESH_PRICE, freeTrait: "fresh-batch" },
};

export function getShopRefreshPrice(
  kind: ShopRefreshKind,
  talentEffects: TalentEffectManifest,
  refreshesLeft: number,
  modifiers: readonly EncounterRewardTraitId[] = [],
  freeRefreshUsed = false,
): number {
  const { basePrice, freeTrait } = SHOP_REFRESH_POLICY[kind];
  if (refreshesLeft > 0 && freeTrait !== null && modifiers.includes(freeTrait)) return 0;
  return talentEffects.shopFreeRefresh && !freeRefreshUsed && refreshesLeft > 0 ? 0 : basePrice;
}

export function computeRemoveCardPrice(
  talentEffects: TalentEffectManifest,
  modifiers: readonly EncounterRewardTraitId[] = [],
  homesteadDiscount = 0,
): number {
  if (modifiers.includes("clean-slate")) return 0;
  return Math.max(0, SHOP_REMOVE_PRICE - (talentEffects.removeCardDiscount + homesteadDiscount));
}

export function computeMixPotionPrice(
  talentEffects: TalentEffectManifest,
  modifiers: readonly EncounterRewardTraitId[] = [],
  homesteadDiscount = 0,
): number {
  if (modifiers.includes("open-kitchen")) return 0;
  return Math.max(0, ALCHEMIST_MIX_PRICE - (talentEffects.mixPotionDiscount + homesteadDiscount));
}
