import { rollLootGearRarity, type LootAvailability, type LootWeights } from "@/lib/loot";
import { pickRandom, sampleItems } from "@/lib/rng";
import { createInstanceId } from "@/lib/utils";
import { gearBaseItemList } from "./base-items";
import { gearDefinitionId, gearDefinitions } from "./definitions";
import { createRolledGearInstance, generateUniqueGearInstance } from "./instances";
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

const NO_OWNED_UNIQUES: ReadonlySet<string> = new Set();

interface GenerateGearOfferingsOptions {
  count: number;
  rng: () => number;
  rollTier: (available: LootAvailability) => GearRarity;
  ownedUniqueIds?: ReadonlySet<string>;
  fillCount?: boolean;
  baseItemIds?: readonly string[] | undefined;
  createId?: () => string;
}

function generateGearOfferings({
  count,
  rng,
  rollTier,
  ownedUniqueIds = NO_OWNED_UNIQUES,
  fillCount = false,
  baseItemIds,
  createId = createInstanceId,
}: GenerateGearOfferingsOptions): GearInstance[] {
  if (count === 0 || (baseItemIds?.length === 0 && Number.isInteger(count) && count > 0)) return [];
  const allowed = baseItemIds === undefined ? null : new Set(baseItemIds);
  // Catalog order owns seeded sampling; caller order and duplicates do not.
  const basePool = allowed ? gearBaseItemList.filter((base) => allowed.has(base.id)) : gearBaseItemList;
  // Sample once before rarity rolls to preserve the run RNG sequence. Reservations
  // alone exclude selected bases; the sampled order never needs a second mutation.
  const sampledBases = sampleItems(basePool, count, rng);
  const reservedBases = new Map<string, "ordinary" | "unique">();
  const baseIds = new Set<string>();
  for (const base of basePool) baseIds.add(base.id);
  const availableUniques = uniqueItemList.filter(
    (unique) => !ownedUniqueIds.has(unique.id) && baseIds.has(unique.baseItemId),
  );
  const choices: GearInstance[] = [];
  let sampledIndex = 0;
  const reserveBase = (baseId: string, rarity: "ordinary" | "unique") => {
    const alreadyReserved = reservedBases.has(baseId);
    reservedBases.set(baseId, rarity);
    if (alreadyReserved) return;
    // Remove all Uniques sharing this base while retaining catalog order.
    let writeIndex = 0;
    for (const unique of availableUniques) {
      if (unique.baseItemId !== baseId) availableUniques[writeIndex++] = unique;
    }
    availableUniques.length = writeIndex;
  };

  for (let index = 0; index < count; index += 1) {
    const unusedBases: typeof basePool = [];
    let repeatableCount = 0;
    for (const base of basePool) {
      const reservation = reservedBases.get(base.id);
      if (reservation === "unique") continue;
      repeatableCount++;
      if (reservation === undefined) unusedBases.push(base);
    }
    const eligibleBases =
      unusedBases.length > 0
        ? unusedBases
        : fillCount
          ? basePool.filter((base) => reservedBases.get(base.id) !== "unique")
          : [];
    if (eligibleBases.length === 0) break;

    const availability: LootAvailability = {
      basic: true,
      astral: true,
      // Leave an ordinary base available to fill later slots on a narrow shelf.
      unique: availableUniques.length > 0 && (index === count - 1 || !fillCount || repeatableCount > 1),
    };
    const rarity = rollTier(availability);

    if (rarity === "unique") {
      const unique = pickRandom(availableUniques, rng);
      if (unique) {
        reserveBase(unique.baseItemId, "unique");
        choices.push(generateUniqueGearInstance(unique, createId));
        continue;
      }
      // Weighted rolls exclude unavailable Uniques; only a forced Unique can
      // reach an empty pool, and that reward ends rather than changing rarity.
      break;
    }

    // Reservations only grow, so a skipped sampled base can never become eligible.
    while (sampledIndex < sampledBases.length && reservedBases.has(sampledBases[sampledIndex]!.id)) sampledIndex++;
    const base = sampledBases[sampledIndex] ?? pickRandom(eligibleBases, rng);
    if (!base) break;
    reserveBase(base.id, "ordinary");
    const definition = gearDefinitions[gearDefinitionId(base.id, rarity)];
    if (!definition) break;
    choices.push(createRolledGearInstance(definition, rng, createId));
  }

  return choices;
}

export function generateLootGearChoices(
  count: number,
  rng: () => number,
  weights: LootWeights,
  ownedUniqueIds: ReadonlySet<string> = NO_OWNED_UNIQUES,
  baseItemIds?: readonly string[],
  fillCount = false,
  createId: () => string = createInstanceId,
): GearInstance[] {
  return generateGearOfferings({
    count,
    rng,
    rollTier: (available) => rollLootGearRarity(weights, rng, available),
    ownedUniqueIds,
    baseItemIds,
    fillCount,
    createId,
  });
}

export function generateGearRewardChoicesForRarity(
  count: number,
  rarity: GearRarity,
  rng: () => number,
  ownedUniqueIds: ReadonlySet<string> = NO_OWNED_UNIQUES,
  baseItemIds?: readonly string[],
  fillCount = false,
  createId: () => string = createInstanceId,
): GearInstance[] {
  return generateGearOfferings({
    count,
    rng,
    rollTier: () => rarity,
    ownedUniqueIds,
    baseItemIds,
    fillCount,
    createId,
  });
}
