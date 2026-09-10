import { GEAR_AFFIX_COUNT, GEAR_AFFIX_COUNT_MIN_WEIGHT } from "@/lib/game-constants";
import { rollLootGearRarity, type LootAvailability, type LootWeights } from "@/lib/loot";
import { createInstanceId, pickRandom, sampleItems } from "@/lib/utils";
import { rollAffixes } from "./affix-pool";
import { gearBaseItemList, gearBaseItems, type GearBaseItemId } from "./base-items";
import { gearDefinitionId, gearDefinitions } from "./definitions";
import { GEAR_RARITIES } from "./types";
import { uniqueItemList, type UniqueItemDefinition } from "./unique-catalog";
import type { GearAffixRoll, GearDefinition, GearInstance, GearRarity } from "./types";

export { buildEligibleAffixPool } from "./affix-pool";

export function generateUniqueGearInstance(uniqueDef: UniqueItemDefinition): GearInstance {
  return {
    instanceId: createInstanceId(),
    definitionId: uniqueDef.id,
    affixes: [uniqueDef.signatureAffix, ...uniqueDef.supportingAffixes].map((affix) => ({ ...affix })),
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
  rollTier: (available: LootAvailability) => GearRarity;
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
    const available = getGearLootAvailability(
      excluded,
      eligible.map((base) => base.id),
    );
    available.unique =
      Boolean(
        getGearLootAvailability(
          excluded,
          unused.map((base) => base.id),
        ).unique,
      ) &&
      (index === count - 1 || !fillCount || repeatable.length > 1);
    const instance = rollOfferingInstance(
      rollTier(available),
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
  let index = 0;
  return generateGearOfferings({
    count: rarities.length,
    rng,
    rollTier: () => rarities[index++]!,
    ownedUniqueIds,
  });
}

export function rollAffixCount(rarity: GearRarity, rng: () => number): number {
  const range = GEAR_AFFIX_COUNT[rarity];
  if (range.max <= range.min) return range.min;
  return rng() < GEAR_AFFIX_COUNT_MIN_WEIGHT ? range.min : range.max;
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
  const baseItem = pickRandom(gearBaseItemList, rng);
  if (!baseItem) throw new Error("gearBaseItemList is empty");
  const definition = gearDefinitions[gearDefinitionId(baseItem.id, rarity)];
  if (!definition) throw new Error(`Missing gear definition for ${baseItem.id}-${rarity}`);
  return rollAndCreateInstance(definition, rarity, rng);
}
