import { GEAR_AFFIX_COUNT, GEAR_AFFIX_COUNT_MIN_WEIGHT } from "@/lib/game-constants";
import { rollLootGearRarity, type LootAvailability, type LootWeights } from "@/lib/loot";
import { pickRandom, sampleItems } from "@/lib/rng";
import { createInstanceId } from "@/lib/utils";
import { rollAffixes } from "./affix-pool";
import { gearBaseItemList, gearBaseItems, type GearBaseItemId } from "./base-items";
import { gearDefinitionId, gearDefinitions } from "./definitions";
import { GEAR_RARITIES } from "./types";
import { uniqueItemList, type UniqueItemDefinition } from "./unique-catalog";
import type { GearAffixRoll, GearDefinition, GearInstance, GearRarity } from "./types";

export function generateUniqueGearInstance(uniqueDef: UniqueItemDefinition): GearInstance {
  // Unique affixes are canonical per definition (see getUniqueAffixes); the
  // instance stores no rolls so saved items can never diverge from the catalog.
  return {
    instanceId: createInstanceId(),
    definitionId: uniqueDef.id,
    affixes: [],
  };
}

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

interface GenerateGearOfferingsOptions {
  count: number;
  rng: () => number;
  rollTier: (available: LootAvailability, index: number) => GearRarity;
  ownedUniqueIds?: ReadonlySet<string>;
  fallbackUniqueToAstral?: boolean;
  fillCount?: boolean;
  basePool?: typeof gearBaseItemList;
}

function generateGearOfferings({
  count,
  rng,
  rollTier,
  ownedUniqueIds = new Set(),
  fallbackUniqueToAstral = true,
  fillCount = false,
  basePool = gearBaseItemList,
}: GenerateGearOfferingsOptions): GearInstance[] {
  // Sample once before rarity rolls to preserve the run RNG sequence. Reservations
  // alone exclude selected bases; the sampled order never needs a second mutation.
  const sampledBases = sampleItems(basePool, count, rng);
  const reservedBases = new Map<string, "ordinary" | "unique">();
  const unownedUniques = uniqueItemList.filter(
    (unique) => !ownedUniqueIds.has(unique.id) && basePool.some((base) => base.id === unique.baseItemId),
  );
  const choices: GearInstance[] = [];

  for (let index = 0; index < count; index += 1) {
    const unusedBases = basePool.filter((base) => !reservedBases.has(base.id));
    const repeatableBases = basePool.filter((base) => reservedBases.get(base.id) !== "unique");
    const eligibleBases = unusedBases.length > 0 ? unusedBases : fillCount ? repeatableBases : [];
    if (eligibleBases.length === 0) break;

    const availableUniques = unownedUniques.filter((unique) => !reservedBases.has(unique.baseItemId));
    const availability = getGearLootAvailability(
      ownedUniqueIds,
      eligibleBases.map((base) => base.id),
    );
    // Leave an ordinary base available to fill later slots on a narrow shelf.
    availability.unique =
      availableUniques.length > 0 && (index === count - 1 || !fillCount || repeatableBases.length > 1);
    let rarity = rollTier(availability, index);

    if (rarity === "unique") {
      const unique = pickRandom(availableUniques, rng);
      if (unique) {
        reservedBases.set(unique.baseItemId, "unique");
        choices.push(generateUniqueGearInstance(unique));
        continue;
      }
      if (!fallbackUniqueToAstral) break;
      rarity = "astral";
    }

    const base =
      sampledBases.find((item) => !reservedBases.has(item.id)) ??
      pickRandom(unusedBases.length > 0 ? unusedBases : repeatableBases, rng);
    if (!base) break;
    reservedBases.set(base.id, "ordinary");
    const definition = gearDefinitions[gearDefinitionId(base.id, rarity)];
    if (!definition) break;
    choices.push(rollAndCreateInstance(definition, rarity, rng));
  }

  return choices;
}

export function generateLootGearChoices(
  count: number,
  rng: () => number,
  weights: LootWeights,
  ownedUniqueIds: ReadonlySet<string> = new Set(),
  baseItemIds?: readonly string[],
  fillCount = false,
): GearInstance[] {
  return generateGearOfferings({
    count,
    rng,
    rollTier: (available) => rollLootGearRarity(weights, rng, available),
    ownedUniqueIds,
    basePool: baseItemIds ? gearBaseItemList.filter((base) => baseItemIds.includes(base.id)) : gearBaseItemList,
    fillCount,
  });
}

export function generateGearRewardChoicesForRarity(
  count: number,
  rarity: GearRarity,
  rng: () => number,
  ownedUniqueIds: ReadonlySet<string> = new Set(),
  baseItemIds?: readonly string[],
  fillCount = false,
): GearInstance[] {
  return generateGearOfferings({
    count,
    rng,
    rollTier: () => rarity,
    ownedUniqueIds,
    fallbackUniqueToAstral: false,
    basePool: baseItemIds ? gearBaseItemList.filter((base) => baseItemIds.includes(base.id)) : gearBaseItemList,
    fillCount,
  });
}

export function generateGearRewardChoicesForRarities(
  rarities: readonly GearRarity[],
  rng: () => number,
  ownedUniqueIds: ReadonlySet<string> = new Set(),
): GearInstance[] {
  return generateGearOfferings({
    count: rarities.length,
    rng,
    rollTier: (_available, index) => {
      const rarity = rarities[index];
      if (!rarity) throw new Error("generateGearRewardChoicesForRarities: rarity index out of range");
      return rarity;
    },
    ownedUniqueIds,
  });
}

export function rollAffixCount(rarity: GearRarity, rng: () => number): number {
  const range = GEAR_AFFIX_COUNT[rarity];
  if (range.max <= range.min) return range.min;
  const draw = rng();
  if (draw < GEAR_AFFIX_COUNT_MIN_WEIGHT) return range.min;
  // Uniform across the remaining counts so wider future ranges can hit middles.
  const rest = range.max - range.min;
  return (
    range.min +
    1 +
    Math.min(rest - 1, Math.floor(((draw - GEAR_AFFIX_COUNT_MIN_WEIGHT) / (1 - GEAR_AFFIX_COUNT_MIN_WEIGHT)) * rest))
  );
}

export function createGearInstance(definition: GearDefinition, affixes: GearAffixRoll[] = []): GearInstance {
  return {
    instanceId: createInstanceId(),
    definitionId: definition.id,
    affixes,
  };
}

function rollAndCreateInstance(definition: GearDefinition, rarity: GearRarity, rng: () => number): GearInstance {
  const affixCount = rollAffixCount(rarity, rng);
  return createGearInstance(definition, rollAffixes(definition, affixCount, rng));
}

export function generateGearInstanceForBaseItem(
  baseItemId: string,
  rng: () => number,
  rarity: "basic" | "astral" = "basic",
): GearInstance | null {
  if (!(baseItemId in gearBaseItems)) return null;
  const baseItem = gearBaseItems[baseItemId as GearBaseItemId];
  const definition = gearDefinitions[gearDefinitionId(baseItem.id, rarity)];
  if (!definition) return null;
  return rollAndCreateInstance(definition, rarity, rng);
}

export function generateDevRandomGearInstance(rng: () => number): GearInstance {
  const rarity = pickRandom(GEAR_RARITIES, rng) ?? "basic";
  if (rarity === "unique") {
    const unique = pickRandom(uniqueItemList, rng);
    if (unique) return generateUniqueGearInstance(unique);
  }
  // A missed Unique roll (exhausted pool) falls back to Astral, never to a
  // nonexistent "<base>-unique" definition.
  const fallbackRarity = rarity === "unique" ? "astral" : rarity;
  const baseItem = pickRandom(gearBaseItemList, rng);
  if (!baseItem) throw new Error("gearBaseItemList is empty");
  const definition =
    gearDefinitions[gearDefinitionId(baseItem.id, fallbackRarity)] ??
    gearDefinitions[gearDefinitionId(baseItem.id, "basic")];
  if (!definition?.rarity) throw new Error(`Missing gear definition for ${baseItem.id}`);
  return rollAndCreateInstance(definition, definition.rarity, rng);
}
