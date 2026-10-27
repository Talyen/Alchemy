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
import { applyStrongSpiritsToPotions, createAlchemistBrewOffers } from "@/lib/alchemist/brewing";
export { applyStrongSpiritsToPotions } from "@/lib/alchemist/brewing";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { labyrinthCardShopPool } from "@/lib/content-systems/labyrinth/room-rules";
import {
  ALCHEMIST_POTIONS_OFFERED,
  EQUIPMENT_SHOP_OFFERED,
  SHOP_CARDS_OFFERED,
  TRINKET_SHOP_OFFERED,
} from "@/lib/game-constants";
import {
  getOfferableCardPool,
  getStandardPotionPool,
  selectRewardCards,
  trinketLibrary,
  type BattleCard,
  type TrinketEntry,
} from "@/lib/game-data";
import {
  gearDefinitions,
  generateGearRewardChoicesForRarity,
  generateLootGearChoices,
  getGearLootAvailability,
  type GearInstance,
} from "@/lib/gear";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { isLootEligible, resolveLootWeights, type LootProgress } from "@/lib/loot";
import { sampleItemsExcluding } from "@/lib/rng";
import { createInstanceId } from "@/lib/utils";

export type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState };

export function merchantShopPool(modifiers: readonly EncounterRewardTraitId[] = []): BattleCard[] {
  return labyrinthCardShopPool(getOfferableCardPool(), modifiers);
}

export function resampleCardShopOfferings(
  deck: BattleCard[],
  pool: BattleCard[],
  currentItems: BattleCard[],
  count: number,
  rng: () => number,
): BattleCard[] {
  const novel = selectRewardCards(deck, pool, count, currentItems, rng);
  if (novel.length >= count) return novel;
  return [...novel, ...selectRewardCards(deck, pool, count - novel.length, novel, rng)];
}

const NO_CURRENT_TRINKETS: ReadonlySet<string> = new Set();

// Initial visits sample unconditionally: shop rooms only generate once their
// loot is eligible, while refreshes re-check depth in case it changed.
function sampleUnownedTrinkets(
  rng: () => number,
  ownedIds: readonly string[] = [],
  currentIds: readonly string[] = [],
): TrinketEntry[] {
  const owned = ownedIds.length ? new Set(ownedIds) : undefined;
  const available = owned ? trinketLibrary.filter((entry) => !owned.has(entry.id)) : trinketLibrary;
  const current = currentIds.length ? new Set(currentIds) : NO_CURRENT_TRINKETS;
  const novel = sampleItemsExcluding(available, TRINKET_SHOP_OFFERED, rng, current, (entry) => entry.id);
  if (novel.length >= TRINKET_SHOP_OFFERED) return novel;
  // Too few unseen offerings: top up from the same pool, keeping only the
  // already-sampled novel picks excluded (current shelf items may return).
  const novelIds = new Set<string>();
  for (const entry of novel) novelIds.add(entry.id);
  return [
    ...novel,
    ...sampleItemsExcluding(available, TRINKET_SHOP_OFFERED - novel.length, rng, novelIds, (entry) => entry.id),
  ];
}

export function resampleTrinketShopOfferings(
  rng: () => number,
  lootProgress: LootProgress,
  ownedIds: readonly string[] = [],
  currentIds: readonly string[] = [],
): TrinketEntry[] {
  if (!isLootEligible("trinket", lootProgress.depth)) return [];
  return sampleUnownedTrinkets(rng, ownedIds, currentIds);
}

export function resampleEquipmentShopOfferings(
  rng: () => number,
  lootProgress: LootProgress,
  gearAstralChanceBonus = 0,
  ownedUniqueIds?: ReadonlySet<string>,
  modifiers: readonly EncounterRewardTraitId[] = [],
  currentItems: readonly GearInstance[] = [],
  createId: () => string = createInstanceId,
): GearInstance[] {
  const baseItems: string[] = [];
  if (modifiers.includes("bowyer")) baseItems.push("shortbow", "longbow", "recurve-bow");
  else {
    const armorer = modifiers.includes("armorer");
    for (const item of gearBaseItemList) if (!armorer || item.compatibleSlots.includes("body")) baseItems.push(item.id);
  }
  const currentBases = new Set<string | undefined>();
  for (const item of currentItems) currentBases.add(gearDefinitions[item.definitionId]?.baseItemId);
  const novelBases = currentBases.size ? baseItems.filter((id) => !currentBases.has(id)) : baseItems;
  const sample = (count: number, baseItemIds: readonly string[]) => {
    if (modifiers.includes("masterwork")) {
      return generateGearRewardChoicesForRarity(count, "astral", rng, ownedUniqueIds, baseItemIds, true, createId);
    }
    return generateLootGearChoices(
      count,
      rng,
      resolveLootWeights({
        source: "equipment",
        progress: lootProgress,
        astralChanceBonus: gearAstralChanceBonus,
        available: getGearLootAvailability(ownedUniqueIds, baseItemIds),
      }),
      ownedUniqueIds,
      baseItemIds,
      true,
      createId,
    );
  };
  const novel = sample(Math.min(EQUIPMENT_SHOP_OFFERED, novelBases.length), novelBases);
  if (novel.length >= EQUIPMENT_SHOP_OFFERED) return novel;
  const selected = new Set<string | undefined>();
  for (const item of novel) selected.add(gearDefinitions[item.definitionId]?.baseItemId);
  const fallbackBases = selected.size ? baseItems.filter((id) => !selected.has(id)) : baseItems;
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
    brewOffers: createAlchemistBrewOffers(rng, modifiers),
    potions: applyStrongSpiritsToPotions(
      selectRewardCards(deck, getStandardPotionPool(), ALCHEMIST_POTIONS_OFFERED, [], rng),
      modifiers,
    ),
  };
}

export function createInitialTrinketShopState(rng: () => number, ownedIds: readonly string[] = []): TrinketShopState {
  const trinkets = sampleUnownedTrinkets(rng, ownedIds);
  return {
    ...emptyTrinketShopState(),
    trinkets,
    refreshesLeft: trinkets.length > 0 ? 1 : 0,
  };
}

export function createInitialEquipmentShopState(
  rng: () => number,
  lootProgress: LootProgress,
  gearAstralChanceBonus = 0,
  ownedUniqueIds?: ReadonlySet<string>,
  modifiers: readonly EncounterRewardTraitId[] = [],
  createId: () => string = createInstanceId,
): EquipmentShopState {
  return {
    ...emptyEquipmentShopState(),
    gear: resampleEquipmentShopOfferings(
      rng,
      lootProgress,
      gearAstralChanceBonus,
      ownedUniqueIds,
      modifiers,
      [],
      createId,
    ),
  };
}
