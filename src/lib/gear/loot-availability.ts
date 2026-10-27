import type { LootAvailability } from "@/lib/loot";
import { gearBaseItemList } from "./base-items";
import { gearDefinitionId, gearDefinitions } from "./definitions";
import type { GearInstance } from "./types";
import { uniqueItemList } from "./unique-catalog";

const NO_OWNED_UNIQUES: ReadonlySet<string> = new Set();
const ALL_BASE_ITEM_IDS = gearBaseItemList.map((base) => base.id);
const ALL_BASE_ITEM_ID_SET = new Set(ALL_BASE_ITEM_IDS);

export function getOwnedUniqueDefinitionIds(inventories?: Record<string, GearInstance[]> | null): Set<string> {
  const owned = new Set<string>();
  if (!inventories) return owned;
  for (const list of Object.values(inventories)) {
    for (const inst of list) {
      if (gearDefinitions[inst.definitionId]?.rarity === "unique") {
        owned.add(inst.definitionId);
      }
    }
  }
  return owned;
}

export function getGearLootAvailability(
  ownedUniqueIds: ReadonlySet<string> = NO_OWNED_UNIQUES,
  baseItemIds: readonly string[] = ALL_BASE_ITEM_IDS,
): LootAvailability {
  if (baseItemIds.length === 0) return { basic: false, astral: false, unique: false };
  const allowedBases = baseItemIds === ALL_BASE_ITEM_IDS ? ALL_BASE_ITEM_ID_SET : new Set(baseItemIds);
  let basic = false;
  let astral = false;
  for (const id of baseItemIds) {
    if (!basic) basic = Boolean(gearDefinitions[gearDefinitionId(id, "basic")]);
    if (!astral) astral = Boolean(gearDefinitions[gearDefinitionId(id, "astral")]);
    if (basic && astral) break;
  }
  return {
    basic,
    astral,
    unique: uniqueItemList.some((unique) => allowedBases.has(unique.baseItemId) && !ownedUniqueIds.has(unique.id)),
  };
}

/**
 * Full reward availability: gear rarity gates plus the card/boon/trinket pool
 * flags. Reward, shop, and report call sites share this so pool-exclusion
 * logic cannot drift between screens.
 */
export function getRewardLootAvailability(
  ownedUniqueIds: ReadonlySet<string> = NO_OWNED_UNIQUES,
  pools: {
    baseItemIds?: readonly string[];
    cards?: boolean;
    boons?: boolean;
    trinkets?: boolean;
  } = {},
): LootAvailability {
  return {
    ...getGearLootAvailability(ownedUniqueIds, pools.baseItemIds),
    card: pools.cards ?? true,
    boon: pools.boons ?? true,
    trinket: pools.trinkets ?? true,
  };
}
