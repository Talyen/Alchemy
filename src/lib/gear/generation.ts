import { rollLootGearRarity, type LootAvailability, type LootWeights } from "@/lib/loot";
import { pickRandom, sampleItems } from "@/lib/rng";
import { gearBaseItemList } from "./base-items";
import { gearDefinitionId, gearDefinitions } from "./definitions";
import { generateUniqueGearInstance, createRolledGearInstance } from "./instances";
import { getGearLootAvailability } from "./loot-availability";
import type { GearInstance, GearRarity } from "./types";
import { uniqueItemList } from "./unique-catalog";

export {
  createGearInstance,
  generateDevRandomGearInstance,
  generateGearInstanceForBaseItem,
  generateUniqueGearInstance,
  rollAffixCount,
} from "./instances";
export { getGearLootAvailability, getOwnedUniqueDefinitionIds, getRewardLootAvailability } from "./loot-availability";

function eligibleBasePool(baseItemIds: readonly string[] | undefined): typeof gearBaseItemList {
  if (baseItemIds === undefined) return gearBaseItemList;
  const allowed = new Set(baseItemIds);
  // Catalog order owns seeded sampling; caller order and duplicates do not.
  return gearBaseItemList.filter((base) => allowed.has(base.id));
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
  const baseIds = new Set(basePool.map((base) => base.id));
  const unownedUniques = uniqueItemList.filter(
    (unique) => !ownedUniqueIds.has(unique.id) && baseIds.has(unique.baseItemId),
  );
  const choices: GearInstance[] = [];

  for (let index = 0; index < count; index += 1) {
    const unusedBases: typeof basePool = [];
    let repeatableBaseCount = 0;
    for (const base of basePool) {
      const reservation = reservedBases.get(base.id);
      if (reservation === undefined) unusedBases.push(base);
      if (reservation !== "unique") repeatableBaseCount++;
    }
    const eligibleBases =
      unusedBases.length > 0
        ? unusedBases
        : fillCount
          ? basePool.filter((base) => reservedBases.get(base.id) !== "unique")
          : [];
    if (eligibleBases.length === 0) break;

    // Reservations only accumulate. Compact this call-owned pool in catalog
    // order so later picks retain the same seeded indices without new arrays.
    let kept = 0;
    for (const unique of unownedUniques) {
      if (!reservedBases.has(unique.baseItemId)) unownedUniques[kept++] = unique;
    }
    unownedUniques.length = kept;
    const availableUniques = unownedUniques;
    const availability = getGearLootAvailability(
      ownedUniqueIds,
      eligibleBases.map((base) => base.id),
    );
    // Leave an ordinary base available to fill later slots on a narrow shelf.
    availability.unique = availableUniques.length > 0 && (index === count - 1 || !fillCount || repeatableBaseCount > 1);
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

    const base = sampledBases.find((item) => !reservedBases.has(item.id)) ?? pickRandom(eligibleBases, rng);
    if (!base) break;
    reservedBases.set(base.id, "ordinary");
    const definition = gearDefinitions[gearDefinitionId(base.id, rarity)];
    if (!definition) break;
    choices.push(createRolledGearInstance(definition, rng));
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
    basePool: eligibleBasePool(baseItemIds),
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
    basePool: eligibleBasePool(baseItemIds),
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
