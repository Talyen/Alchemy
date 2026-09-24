import { GEAR_AFFIX_COUNT, GEAR_AFFIX_COUNT_MIN_WEIGHT } from "@/lib/game-constants";
import { rollLootGearRarity, type LootAvailability, type LootWeights } from "@/lib/loot";
import { createInstanceId, pickRandom, sampleItems } from "@/lib/utils";
import { rollAffixes } from "./affix-pool";
import { gearBaseItemList, gearBaseItems, type GearBaseItemId } from "./base-items";
import { gearDefinitionId, gearDefinitions } from "./definitions";
import { GEAR_RARITIES } from "./types";
import { uniqueItemList, type UniqueItemDefinition } from "./unique-catalog";
import type { GearAffixRoll, GearDefinition, GearInstance, GearRarity } from "./types";

type GearBaseItem = (typeof gearBaseItemList)[number];

interface OfferingPool {
  basePool: readonly GearBaseItem[];
  remainingBases: GearBaseItem[];
  ownedUniqueIds: ReadonlySet<string>;
  reservedBases: Map<string, "ordinary" | "unique">;
  fillCount: boolean;
}

interface NextOffering {
  availability: LootAvailability;
  repeatableBases: GearBaseItem[];
}

export function generateUniqueGearInstance(uniqueDef: UniqueItemDefinition): GearInstance {
  // Unique affixes are canonical per definition (see getUniqueAffixes); the
  // instance stores no rolls so saved items can never diverge from the catalog.
  return {
    instanceId: createInstanceId(),
    definitionId: uniqueDef.id,
    affixes: [],
  };
}

function createOfferingPool(
  basePool: readonly GearBaseItem[],
  count: number,
  rng: () => number,
  ownedUniqueIds: ReadonlySet<string>,
  fillCount: boolean,
): OfferingPool {
  return {
    basePool,
    remainingBases: sampleItems(basePool, count, rng),
    ownedUniqueIds,
    reservedBases: new Map(),
    fillCount,
  };
}

function nextOffering(pool: OfferingPool, index: number, count: number): NextOffering | null {
  const unusedBases = pool.basePool.filter((base) => !pool.reservedBases.has(base.id));
  const repeatableBases = pool.basePool.filter((base) => pool.reservedBases.get(base.id) !== "unique");
  const eligibleBases = unusedBases.length > 0 ? unusedBases : pool.fillCount ? repeatableBases : [];
  if (eligibleBases.length === 0) return null;

  const unusedAvailability = getGearLootAvailability(
    pool.ownedUniqueIds,
    unusedBases.map((base) => base.id),
  );
  const availability =
    unusedBases.length > 0
      ? unusedAvailability
      : getGearLootAvailability(
          pool.ownedUniqueIds,
          eligibleBases.map((base) => base.id),
        );
  // A Unique cannot share its base with an earlier ordinary offer. On a
  // filling shelf, reserve the option until a later slot can still be filled.
  availability.unique =
    Boolean(unusedAvailability.unique) && (index === count - 1 || !pool.fillCount || repeatableBases.length > 1);
  return { availability, repeatableBases };
}

function reserveBase(pool: OfferingPool, baseId: string, kind: "ordinary" | "unique"): void {
  pool.reservedBases.set(baseId, kind);
  const sampledIndex = pool.remainingBases.findIndex((item) => item.id === baseId);
  if (sampledIndex >= 0) pool.remainingBases.splice(sampledIndex, 1);
}

function takeOrdinaryBase(pool: OfferingPool, repeatableBases: readonly GearBaseItem[], rng: () => number) {
  const sampled = pool.remainingBases.find((item) => !pool.reservedBases.has(item.id));
  if (sampled) {
    reserveBase(pool, sampled.id, "ordinary");
    return sampled;
  }
  const unused = pickRandom(
    pool.basePool.filter((item) => !pool.reservedBases.has(item.id)),
    rng,
  );
  if (unused) {
    reserveBase(pool, unused.id, "ordinary");
    return unused;
  }
  return pool.fillCount ? pickRandom(repeatableBases, rng) : undefined;
}

function takeUnique(pool: OfferingPool, rng: () => number): GearInstance | null {
  const availableUniques = uniqueItemList.filter(
    (unique) =>
      !pool.ownedUniqueIds.has(unique.id) &&
      !pool.reservedBases.has(unique.baseItemId) &&
      pool.basePool.some((base) => base.id === unique.baseItemId),
  );
  const unique = pickRandom(availableUniques, rng);
  if (!unique) return null;
  reserveBase(pool, unique.baseItemId, "unique");
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

function rollOfferingInstance(
  tier: "unique" | "astral" | "basic",
  pool: OfferingPool,
  repeatableBases: readonly GearBaseItem[],
  rng: () => number,
  fallbackUniqueToAstral: boolean,
): GearInstance | null {
  if (tier === "unique") {
    const uniqueInstance = takeUnique(pool, rng);
    if (uniqueInstance) return uniqueInstance;
    if (!fallbackUniqueToAstral) return null;
    tier = "astral";
  }

  const rarity: GearRarity = tier === "basic" ? "basic" : "astral";
  const baseItem = takeOrdinaryBase(pool, repeatableBases, rng);
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
  const pool = createOfferingPool(basePool, count, rng, ownedUniqueIds, fillCount);
  const choices: GearInstance[] = [];

  for (let index = 0; index < count; index += 1) {
    const next = nextOffering(pool, index, count);
    if (!next) break;
    const instance = rollOfferingInstance(
      rollTier(next.availability, index),
      pool,
      next.repeatableBases,
      rng,
      fallbackUniqueToAstral,
    );
    if (!instance) break;
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
