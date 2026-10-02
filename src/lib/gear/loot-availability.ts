import type { LootAvailability } from "@/lib/loot";
import { gearBaseItemList } from "./base-items";
import { gearDefinitionId, gearDefinitions } from "./definitions";
import type { GearInstance } from "./types";
import { uniqueItemList } from "./unique-catalog";

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
  ownedUniqueIds: ReadonlySet<string> = new Set(),
  baseItemIds: readonly string[] = gearBaseItemList.map((base) => base.id),
): LootAvailability {
  return {
    basic: baseItemIds.some((id) => Boolean(gearDefinitions[gearDefinitionId(id, "basic")])),
    astral: baseItemIds.some((id) => Boolean(gearDefinitions[gearDefinitionId(id, "astral")])),
    unique: uniqueItemList.some((unique) => baseItemIds.includes(unique.baseItemId) && !ownedUniqueIds.has(unique.id)),
  };
}

/**
 * Full reward availability: gear rarity gates plus the card/boon/trinket pool
 * flags. Reward, shop, and report call sites share this so pool-exclusion
 * logic cannot drift between screens.
 */
export function getRewardLootAvailability(
  ownedUniqueIds: ReadonlySet<string> = new Set(),
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
