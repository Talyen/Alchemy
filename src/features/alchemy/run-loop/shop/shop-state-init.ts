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
import { generateEquipmentShopOfferings, type GearInstance } from "@/lib/gear";
import { trinketLibrary } from "@/lib/game-data";
import { sampleItems } from "@/lib/utils";

export type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState };

// Refresh keeps the shelf full while maximizing novelty: when enough unowned
// alternatives exist outside `currentIds`, the shelf is entirely novel; when the
// pool is nearly exhausted it fills with whatever remains (may reuse). If fewer
// than TRINKET_SHOP_OFFERED trinkets are unowned at all, the shelf caps at the
// available count — sampleItems clamps to the pool size.
export function resampleTrinketShopOfferings(
  rng: () => number,
  ownedIds: readonly string[] = [],
  currentIds: readonly string[] = [],
): TrinketEntry[] {
  const owned = new Set(ownedIds);
  const current = new Set(currentIds);
  const available = trinketLibrary.filter((entry) => !owned.has(entry.id));
  const novel = sampleItems(
    available.filter((entry) => !current.has(entry.id)),
    TRINKET_SHOP_OFFERED,
    rng,
  );
  if (novel.length >= TRINKET_SHOP_OFFERED) return novel;

  const selected = new Set(novel.map((entry) => entry.id));
  const fallback = sampleItems(
    available.filter((entry) => !selected.has(entry.id)),
    TRINKET_SHOP_OFFERED - novel.length,
    rng,
  );
  return [...novel, ...fallback];
}

export function resampleEquipmentShopOfferings(
  rng: () => number,
  gearAstralChanceBonus = 0,
  ownedUniqueIds?: ReadonlySet<string>,
): GearInstance[] {
  return generateEquipmentShopOfferings(EQUIPMENT_SHOP_OFFERED, rng, gearAstralChanceBonus, ownedUniqueIds);
}

/** `firstPurchaseUsed` resets per visit (`empty*State`); Merchant's Favor is first purchase at each shop. */
export function createInitialShopState(deck: BattleCard[], rng: () => number): ShopState {
  return {
    ...emptyShopState(),
    cards: selectRewardCards(deck, getOfferableCardPool(), SHOP_CARDS_OFFERED, [], rng),
  };
}

export function createInitialAlchemistState(deck: BattleCard[], rng: () => number): AlchemistState {
  return {
    ...emptyAlchemistState(),
    potions: selectRewardCards(deck, getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED, [], rng),
  };
}

export function createInitialTrinketShopState(rng: () => number, ownedIds: readonly string[] = []): TrinketShopState {
  return {
    ...emptyTrinketShopState(),
    trinkets: resampleTrinketShopOfferings(rng, ownedIds),
  };
}

export function createInitialEquipmentShopState(
  rng: () => number,
  gearAstralChanceBonus = 0,
  ownedUniqueIds?: ReadonlySet<string>,
): EquipmentShopState {
  return {
    ...emptyEquipmentShopState(),
    gear: resampleEquipmentShopOfferings(rng, gearAstralChanceBonus, ownedUniqueIds),
  };
}
