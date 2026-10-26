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
  ownedUniqueIds = new Set(),
  fillCount = false,
  baseItemIds,
  createId = createInstanceId,
}: GenerateGearOfferingsOptions): GearInstance[] {
  const allowed = baseItemIds === undefined ? null : new Set(baseItemIds);
  // Catalog order owns seeded sampling; caller order and duplicates do not.
  const basePool = allowed ? gearBaseItemList.filter((base) => allowed.has(base.id)) : gearBaseItemList;
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
    const repeatableBases = basePool.filter((base) => reservedBases.get(base.id) !== "unique");
    const unusedBases = repeatableBases.filter((base) => !reservedBases.has(base.id));
    const eligibleBases = unusedBases.length > 0 ? unusedBases : fillCount ? repeatableBases : [];
    if (eligibleBases.length === 0) break;

    const availableUniques = unownedUniques.filter((unique) => !reservedBases.has(unique.baseItemId));
    const availability: LootAvailability = {
      basic: true,
      astral: true,
      // Leave an ordinary base available to fill later slots on a narrow shelf.
      unique: availableUniques.length > 0 && (index === count - 1 || !fillCount || repeatableBases.length > 1),
    };
    const rarity = rollTier(availability);

    if (rarity === "unique") {
      const unique = pickRandom(availableUniques, rng);
      if (unique) {
        reservedBases.set(unique.baseItemId, "unique");
        choices.push(generateUniqueGearInstance(unique, createId));
        continue;
      }
      // Weighted rolls exclude unavailable Uniques; only a forced Unique can
      // reach an empty pool, and that reward ends rather than changing rarity.
      break;
    }

    const base = sampledBases.find((item) => !reservedBases.has(item.id)) ?? pickRandom(eligibleBases, rng);
    if (!base) break;
    reservedBases.set(base.id, "ordinary");
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
  ownedUniqueIds: ReadonlySet<string> = new Set(),
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
  ownedUniqueIds: ReadonlySet<string> = new Set(),
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
