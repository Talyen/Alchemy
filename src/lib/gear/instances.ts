import { GEAR_AFFIX_COUNT, GEAR_AFFIX_COUNT_MIN_WEIGHT } from "@/lib/game-constants";
import { pickRandom } from "@/lib/rng";
import { createInstanceId } from "@/lib/utils";
import { rollAffixes } from "./affix-pool";
import { gearBaseItemList, gearBaseItems, type GearBaseItemId } from "./base-items";
import { gearDefinitionId, gearDefinitions } from "./definitions";
import { GEAR_RARITIES, type GearAffixRoll, type GearDefinition, type GearInstance, type GearRarity } from "./types";
import { uniqueItemList, type UniqueItemDefinition } from "./unique-catalog";

export function generateUniqueGearInstance(
  uniqueDef: UniqueItemDefinition,
  createId: () => string = createInstanceId,
): GearInstance {
  // Unique affixes are canonical per definition (see getUniqueAffixes); the
  // instance stores no rolls so saved items can never diverge from the catalog.
  return {
    instanceId: createId(),
    definitionId: uniqueDef.id,
    affixes: [],
  };
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

export function createGearInstance(
  definition: GearDefinition,
  affixes: GearAffixRoll[] = [],
  createId: () => string = createInstanceId,
): GearInstance {
  return {
    instanceId: createId(),
    definitionId: definition.id,
    affixes,
  };
}

export function createRolledGearInstance(
  definition: GearDefinition,
  rng: () => number,
  createId: () => string = createInstanceId,
): GearInstance {
  const affixCount = rollAffixCount(definition.rarity ?? "basic", rng);
  return createGearInstance(definition, rollAffixes(definition, affixCount, rng), createId);
}

export function generateGearInstanceForBaseItem(
  baseItemId: string,
  rng: () => number,
  rarity: "basic" | "astral" = "basic",
  createId: () => string = createInstanceId,
): GearInstance | null {
  if (!Object.hasOwn(gearBaseItems, baseItemId)) return null;
  const baseItem = gearBaseItems[baseItemId as GearBaseItemId];
  const definition = gearDefinitions[gearDefinitionId(baseItem.id, rarity)];
  if (!definition) return null;
  return createRolledGearInstance(definition, rng, createId);
}

export function generateDevRandomGearInstance(
  rng: () => number,
  createId: () => string = createInstanceId,
): GearInstance {
  const rarity = pickRandom(GEAR_RARITIES, rng) ?? "basic";
  if (rarity === "unique") {
    const unique = pickRandom(uniqueItemList, rng);
    if (unique) return generateUniqueGearInstance(unique, createId);
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
  return createRolledGearInstance(definition, rng, createId);
}
