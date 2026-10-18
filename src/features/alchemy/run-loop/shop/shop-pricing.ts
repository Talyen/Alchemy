import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readEquippedTrinketId } from "@/features/alchemy/shared/stores/gear-store";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { snapshotTransactionValue, type RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import { readActivityData, type ShopActivity } from "@/lib/active-run-session";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { activeLabyrinthBenefits } from "@/lib/content-systems/labyrinth/room-rules";
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
import { computeTalentEffects, type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import { isStandardPotionCard } from "@/lib/game-data/cards/card-pools";
import { gearDefinitions, type GearInstance } from "@/lib/gear";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { combineTrinketEffectIds, getTrinketEffectValue } from "@/lib/trinkets";

export interface ShopBuyPriceContext {
  modifiers?: readonly EncounterRewardTraitId[];
  talentEffects: TalentEffectManifest;
  runBoons: string[];
  firstPurchaseUsed: boolean;
}

export interface ShopDiscounts {
  talentEffects: TalentEffectManifest;
  homesteadEffects: HomesteadEffectManifest;
  modifiers: readonly EncounterRewardTraitId[];
}

export function readShopDiscounts(gameSession: GameSession): ShopDiscounts {
  const profile = readRunProfile(gameSession);
  const run = readActiveRun(gameSession);
  return {
    talentEffects: computeTalentEffects(profile.unlockedTalents),
    homesteadEffects: profile.effects,
    modifiers:
      activeLabyrinthBenefits(run.contentSystemType, readRunSession(gameSession).activeLabyrinthRewardModifiers) ?? [],
  };
}

export function draftShopDiscounts(draft: RunTransaction): ShopDiscounts {
  return {
    talentEffects: computeTalentEffects(snapshotTransactionValue(draft.runProfile.unlockedTalents)),
    homesteadEffects: draft.runProfile.effects,
    modifiers:
      activeLabyrinthBenefits(draft.run.activeRun.contentSystemType, draft.session.activeLabyrinthRewardModifiers) ??
      [],
  };
}

function pricingContext(discounts: ShopDiscounts, runBoons: string[], firstPurchaseUsed: boolean): ShopBuyPriceContext {
  return {
    talentEffects: discounts.talentEffects,
    modifiers: discounts.modifiers,
    runBoons,
    firstPurchaseUsed,
  };
}

export function readShopPricingContext(activity: ShopActivity, gameSession: GameSession): ShopBuyPriceContext {
  const run = readActiveRun(gameSession);
  return pricingContext(
    readShopDiscounts(gameSession),
    combineTrinketEffectIds(run.runBoons, readEquippedTrinketId(run.characterId, gameSession)),
    readActivityData(readRunSession(gameSession).activity, activity).firstPurchaseUsed,
  );
}

export function draftShopPricingContext(draft: RunTransaction, firstPurchaseUsed: boolean): ShopBuyPriceContext {
  return pricingContext(
    draftShopDiscounts(draft),
    combineTrinketEffectIds(draft.run.activeRun.runBoons, draft.gear.equippedTrinkets[draft.run.activeRun.characterId]),
    firstPurchaseUsed,
  );
}

function getEquipmentBuyPolicy(instance: GearInstance): { basePrice: number; trait: "apprentice" | null } {
  const rarity = gearDefinitions[instance.definitionId]?.rarity;
  if (rarity === "unique") return { basePrice: EQUIPMENT_SHOP_UNIQUE_PRICE, trait: null };
  if (rarity === "astral") return { basePrice: EQUIPMENT_SHOP_ASTRAL_PRICE, trait: null };
  return { basePrice: EQUIPMENT_SHOP_BASIC_PRICE, trait: rarity === "basic" ? "apprentice" : null };
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

export type ShopBuyRequest =
  | { kind: "merchantCard" | "alchemistPotion"; item: BattleCard; context: ShopBuyPriceContext }
  | { kind: "gear"; item: GearInstance; context: ShopBuyPriceContext }
  | { kind: "trinket"; item: null; context: ShopBuyPriceContext };

export function getShopBuyPrice({ kind, item, context }: ShopBuyRequest): number {
  const { basePrice, trait, multiplier } =
    kind === "gear"
      ? { ...getEquipmentBuyPolicy(item), multiplier: LABYRINTH_MODIFIER_CONFIG.half }
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
    : Math.max(0, price - getTrinketEffectValue(context.runBoons, "merchantsFavorDiscount"));
}

const SHOP_REFRESH_POLICY: Record<ShopActivity, { basePrice: number; freeTrait: EncounterRewardTraitId | null }> = {
  shop: { basePrice: SHOP_REFRESH_PRICE, freeTrait: null },
  "equipment-shop": { basePrice: SHOP_REFRESH_PRICE, freeTrait: null },
  "trinket-shop": { basePrice: SHOP_REFRESH_PRICE, freeTrait: "fresh-curios" },
  alchemist: { basePrice: ALCHEMIST_REFRESH_PRICE, freeTrait: "fresh-batch" },
};

export function getShopRefreshPrice(
  kind: ShopActivity,
  refreshesLeft: number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): number {
  const { basePrice, freeTrait } = SHOP_REFRESH_POLICY[kind];
  if (refreshesLeft > 0 && freeTrait !== null && modifiers.includes(freeTrait)) return 0;
  return basePrice;
}

function computeServicePrice(
  basePrice: number,
  freeTrait: EncounterRewardTraitId,
  modifiers: readonly EncounterRewardTraitId[],
  talentDiscount: number,
  homesteadDiscount: number,
): number {
  if (modifiers.includes(freeTrait)) return 0;
  return Math.max(0, basePrice - (talentDiscount + homesteadDiscount));
}

export function computeRemoveCardPrice(
  talentEffects: TalentEffectManifest,
  modifiers: readonly EncounterRewardTraitId[] = [],
  homesteadDiscount = 0,
): number {
  return computeServicePrice(
    SHOP_REMOVE_PRICE,
    "clean-slate",
    modifiers,
    talentEffects.removeCardDiscount,
    homesteadDiscount,
  );
}

export function computeMixPotionPrice(
  talentEffects: TalentEffectManifest,
  modifiers: readonly EncounterRewardTraitId[] = [],
  homesteadDiscount = 0,
): number {
  return computeServicePrice(
    ALCHEMIST_MIX_PRICE,
    "open-kitchen",
    modifiers,
    talentEffects.mixPotionDiscount,
    homesteadDiscount,
  );
}
