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
import { gearDefinitions, generateEquipmentShopOfferings, type GearInstance } from "@/lib/gear";
import { trinketLibrary } from "@/lib/game-data";
import { sampleItems } from "@/lib/utils";

export type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState };

export function merchantShopPool(modifiers: readonly EncounterRewardTraitId[] = []): BattleCard[] {
  return labyrinthCardShopPool(getOfferableCardPool(), modifiers);
}

export function applyStrongSpiritsToPotions(
  potions: BattleCard[],
  modifiers: readonly EncounterRewardTraitId[] = [],
): BattleCard[] {
  return modifiers.includes("strong-spirits") ? potions.map(doublePotionPotency) : potions;
}

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
  currentItems: readonly GearInstance[] = [],
): GearInstance[] {
  const baseItems = modifiers.includes("bowyer")
    ? ["shortbow", "longbow", "recurve-bow"]
    : modifiers.includes("armorer")
      ? gearBaseItemList.filter((item) => item.compatibleSlots.includes("body")).map((item) => item.id)
      : gearBaseItemList.map((item) => item.id);
  const currentBases = new Set<string | undefined>(
    currentItems.map((item) => gearDefinitions[item.definitionId]?.baseItemId),
  );
  const novelBases = baseItems.filter((id) => !currentBases.has(id));
  const sample = (count: number, baseItemIds: readonly string[]) =>
    generateEquipmentShopOfferings(count, rng, gearAstralChanceBonus, ownedUniqueIds, {
      baseItemIds,
      ...(modifiers.includes("masterwork") ? { rarity: "astral" as const } : {}),
    });
  const novel = sample(Math.min(EQUIPMENT_SHOP_OFFERED, novelBases.length), novelBases);
  if (novel.length >= EQUIPMENT_SHOP_OFFERED) return novel;
  const selected = new Set<string | undefined>(novel.map((item) => gearDefinitions[item.definitionId]?.baseItemId));
  const fallbackBases = baseItems.filter((id) => !selected.has(id));
  return [...novel, ...sample(EQUIPMENT_SHOP_OFFERED - novel.length, fallbackBases.length ? fallbackBases : baseItems)];
}

export function createInitialShopState(
  deck: BattleCard[],
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): ShopState {
  return {
    ...emptyShopState(),
    cards: selectRewardCards(deck, merchantShopPool(modifiers), SHOP_CARDS_OFFERED, [], rng),
  };
}

export function createInitialAlchemistState(
  deck: BattleCard[],
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): AlchemistState {
  return {
    ...emptyAlchemistState(),
    potions: applyStrongSpiritsToPotions(
      selectRewardCards(deck, getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED, [], rng),
      modifiers,
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
