import { GEAR_AFFIX_COUNT, GEAR_AFFIX_COUNT_MIN_WEIGHT } from "@/lib/game-constants";
import { rollLootGearRarity, type LootAvailability, type LootWeights } from "@/lib/loot";
import { createInstanceId, pickRandom, sampleItems } from "@/lib/utils";
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

function takeUnusedBaseItem(
  remaining: Array<(typeof gearBaseItemList)[number]>,
  usedIds: Set<string>,
  rng: () => number,
  basePool = gearBaseItemList,
): (typeof gearBaseItemList)[number] | undefined {
  const sampledIndex = remaining.findIndex((item) => !usedIds.has(item.id));
  if (sampledIndex >= 0) {
    const [item] = remaining.splice(sampledIndex, 1);
    if (item) usedIds.add(item.id);
    return item;
  }
  const picked = pickRandom(
    basePool.filter((item) => !usedIds.has(item.id)),
    rng,
  );
  if (picked) usedIds.add(picked.id);
  return picked;
}

function tryOfferUnique(
  ownedUniqueIds: ReadonlySet<string>,
  offeredUniqueIds: Set<string>,
  usedBaseIds: Set<string>,
  remainingBases: Array<(typeof gearBaseItemList)[number]>,
  rng: () => number,
  basePool = gearBaseItemList,
): GearInstance | null {
  const availableUniques = uniqueItemList.filter(
    (unique) =>
      !ownedUniqueIds.has(unique.id) &&
      !offeredUniqueIds.has(unique.id) &&
      !usedBaseIds.has(unique.baseItemId) &&
      basePool.some((base) => base.id === unique.baseItemId),
  );
  const unique = pickRandom(availableUniques, rng);
  if (!unique) return null;
  offeredUniqueIds.add(unique.id);
  usedBaseIds.add(unique.baseItemId);
  const sampledIndex = remainingBases.findIndex((item) => item.id === unique.baseItemId);
  if (sampledIndex >= 0) remainingBases.splice(sampledIndex, 1);
  return generateUniqueGearInstance(unique);
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

interface GenerateGearOfferingsOptions {
  count: number;
  rng: () => number;
  rollTier: (available: LootAvailability, index: number) => GearRarity;
  ownedUniqueIds?: ReadonlySet<string>;
  fallbackUniqueToAstral?: boolean;
  fillCount?: boolean;
  basePool?: typeof gearBaseItemList;
}

function rollOfferingInstance(
  tier: "unique" | "astral" | "basic",
  ownedUniqueIds: ReadonlySet<string>,
  offeredUniqueIds: Set<string>,
  usedBaseIds: Set<string>,
  remainingBases: Array<(typeof gearBaseItemList)[number]>,
  rng: () => number,
  baseItemSupplier: () => (typeof gearBaseItemList)[number] | undefined,
  fallbackUniqueToAstral: boolean,
  basePool = gearBaseItemList,
): GearInstance | null {
  if (tier === "unique") {
    const uniqueInstance = tryOfferUnique(ownedUniqueIds, offeredUniqueIds, usedBaseIds, remainingBases, rng, basePool);
    if (uniqueInstance) return uniqueInstance;
    if (!fallbackUniqueToAstral) return null;
    tier = "astral";
  }

  const rarity: GearRarity = tier === "basic" ? "basic" : "astral";
  const baseItem = baseItemSupplier();
  if (!baseItem) return null;
  const definition = gearDefinitions[gearDefinitionId(baseItem.id, rarity)];
  return definition ? rollAndCreateInstance(definition, rarity, rng) : null;
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
  const offeredUniqueIds = new Set<string>();
  const usedBaseIds = new Set<string>();
  const remainingBases = sampleItems(basePool, count, rng);
  const choices: GearInstance[] = [];
  const uniqueBases = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const unused = basePool.filter((base) => !usedBaseIds.has(base.id));
    const repeatable = basePool.filter((base) => !uniqueBases.has(base.id));
    const eligible = unused.length > 0 ? unused : fillCount ? repeatable : [];
    if (eligible.length === 0) break;
    const excluded = new Set([...ownedUniqueIds, ...offeredUniqueIds]);
    const unusedAvailability = getGearLootAvailability(
      excluded,
      unused.map((base) => base.id),
    );
    // When nothing is left unused, eligibility falls back to repeatables, but
    // Unique availability is still gated on the unused set (a Unique must
    // never pair with another offering of its base).
    const available =
      eligible === unused
        ? unusedAvailability
        : getGearLootAvailability(
            excluded,
            eligible.map((base) => base.id),
          );
    available.unique =
      // A Unique must never share its base with another offering, so Unique
      // eligibility is gated on the unused set even when filling from
      // repeatables — except on the last slot (or when repeats are allowed
      // and more than one repeatable base remains).
      Boolean(unusedAvailability.unique) && (index === count - 1 || !fillCount || repeatable.length > 1);
    const instance = rollOfferingInstance(
      rollTier(available, index),
      ownedUniqueIds,
      offeredUniqueIds,
      usedBaseIds,
      remainingBases,
      rng,
      () =>
        takeUnusedBaseItem(remainingBases, usedBaseIds, rng, basePool) ??
        (fillCount ? pickRandom(repeatable, rng) : undefined),
      fallbackUniqueToAstral,
      basePool,
    );
    if (!instance) break;
    const definition = gearDefinitions[instance.definitionId];
    if (definition?.rarity === "unique" && definition.baseItemId) uniqueBases.add(definition.baseItemId);
    choices.push(instance);
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
