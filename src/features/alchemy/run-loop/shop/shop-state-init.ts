import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { labyrinthCardShopPool } from "@/lib/content-systems/labyrinth/room-rules";
import { doublePotionPotency } from "@/lib/alchemist";
import { gearBaseItemList } from "@/lib/gear/base-items";
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
  modifiers: readonly EncounterRewardTraitId[] = [],
): GearInstance[] {
  const baseItems = modifiers.includes("bowyer")
    ? ["shortbow", "longbow", "recurve-bow"]
    : modifiers.includes("armorer")
      ? gearBaseItemList.filter((item) => item.compatibleSlots.includes("body")).map((item) => item.id)
      : undefined;
  return generateEquipmentShopOfferings(EQUIPMENT_SHOP_OFFERED, rng, gearAstralChanceBonus, ownedUniqueIds, {
    ...(baseItems ? { baseItemIds: baseItems } : {}),
    ...(modifiers.includes("masterwork") ? { rarity: "astral" as const } : {}),
  });
}

export function createInitialShopState(
  deck: BattleCard[],
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): ShopState {
  return {
    ...emptyShopState(),
    cards: selectRewardCards(
      deck,
      labyrinthCardShopPool(getOfferableCardPool(), modifiers),
      SHOP_CARDS_OFFERED,
      [],
      rng,
    ),
  };
}

export function createInitialAlchemistState(
  deck: BattleCard[],
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): AlchemistState {
  return {
    ...emptyAlchemistState(),
    potions: selectRewardCards(deck, getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED, [], rng).map((card) =>
      modifiers.includes("strong-spirits") ? doublePotionPotency(card) : card,
    ),
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
  modifiers: readonly EncounterRewardTraitId[] = [],
): EquipmentShopState {
  return {
    ...emptyEquipmentShopState(),
    gear: resampleEquipmentShopOfferings(rng, gearAstralChanceBonus, ownedUniqueIds, modifiers),
  };
}
