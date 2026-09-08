import {
  DROP_RATES_BOSS,
  DROP_RATES_NORMAL,
  EQUIPMENT_SHOP_DROP_RATES,
  GEAR_AFFIX_COUNT,
  GEAR_AFFIX_COUNT_MIN_WEIGHT,
  GEAR_REWARD_RARITY_CHANCE,
} from "@/lib/game-constants";
import { clamp } from "@/lib/math";
import { createInstanceId, pickRandom, sampleItems } from "@/lib/utils";
import { rollAffixes } from "./affix-pool";
import { gearBaseItemList, gearBaseItems, type GearBaseItemId } from "./base-items";
import { gearDefinitionId, gearDefinitions } from "./definitions";
import { GEAR_RARITIES } from "./types";
import { uniqueItemList, type UniqueItemDefinition } from "./unique-catalog";
import type { GearAffixRoll, GearDefinition, GearInstance, GearRarity } from "./types";

export { allowedAspectsForDefinition, buildEligibleAffixPool, rollAffixes } from "./affix-pool";

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

interface RollItemDropTierOptions {
  isBoss: boolean;
  allowsUnique?: boolean;
  astralChanceBonus?: number;
}

function resolveRarityTier(
  weights: { unique: number; astral: number },
  rng: () => number,
  options?: { allowsUnique?: boolean | undefined; astralBonus?: number | undefined },
): GearRarity {
  const allowsUnique = options?.allowsUnique !== false;
  const astralBonus = Math.max(0, options?.astralBonus ?? 0);
  const unique = allowsUnique ? weights.unique : 0;
  const astral = weights.astral + astralBonus + (allowsUnique ? 0 : weights.unique);
  const draw = rng();
  if (draw < unique) return "unique";
  if (draw < unique + astral) return "astral";
  return "basic";
}

function rollItemDropTier(options: RollItemDropTierOptions, rng: () => number): GearRarity {
  const base = options.isBoss ? DROP_RATES_BOSS : DROP_RATES_NORMAL;
  return resolveRarityTier(base, rng, { allowsUnique: options.allowsUnique, astralBonus: options.astralChanceBonus });
}

export function rollGearRewardDropTier(rng: () => number, isBoss = false, astralChanceBonus = 0): GearRarity {
  return rollItemDropTier({ isBoss, astralChanceBonus }, rng);
}

function rollEquipmentShopDropTier(astralChanceBonus = 0, rng: () => number, allowsUnique = true): GearRarity {
  return resolveRarityTier(EQUIPMENT_SHOP_DROP_RATES, rng, { allowsUnique, astralBonus: astralChanceBonus });
}

interface GenerateGearOfferingsOptions {
  count: number;
  rng: () => number;
  rollTier: () => "unique" | "astral" | "basic";
  ownedUniqueIds?: ReadonlySet<string>;
  fillFallback?: boolean;
  fallbackUniqueToAstral?: boolean;
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
  fillFallback = false,
  fallbackUniqueToAstral = true,
  basePool = gearBaseItemList,
}: GenerateGearOfferingsOptions): GearInstance[] {
  const offeredUniqueIds = new Set<string>();
  const usedBaseIds = new Set<string>();
  const remainingBases = sampleItems(basePool, count, rng);
  const choices: GearInstance[] = [];

  for (let index = 0; index < count; index += 1) {
    const instance = rollOfferingInstance(
      rollTier(),
      ownedUniqueIds,
      offeredUniqueIds,
      usedBaseIds,
      remainingBases,
      rng,
      () => takeUnusedBaseItem(remainingBases, usedBaseIds, rng, basePool),
      fallbackUniqueToAstral,
      basePool,
    );
    if (!instance) break;
    choices.push(instance);
  }

  if (fillFallback && choices.length < count) {
    let fillAttempts = 0;
    while (choices.length < count && fillAttempts < count * 8) {
      fillAttempts += 1;
      const instance = rollOfferingInstance(
        rollTier(),
        ownedUniqueIds,
        offeredUniqueIds,
        usedBaseIds,
        remainingBases,
        rng,
        () => {
          const baseItem = pickRandom(basePool, rng);
          if (!baseItem) return undefined;
          if (usedBaseIds.has(baseItem.id) && usedBaseIds.size < basePool.length) return undefined;
          usedBaseIds.add(baseItem.id);
          return baseItem;
        },
        fallbackUniqueToAstral,
        basePool,
      );
      if (instance) choices.push(instance);
    }
  }

  return choices;
}

export interface EquipmentShopOfferingRules {
  baseItemIds?: readonly string[];
  rarity?: "astral";
}

export function generateEquipmentShopOfferings(
  count: number,
  rng: () => number,
  astralChanceBonus = 0,
  ownedUniqueIds: ReadonlySet<string> = new Set(),
  rules: EquipmentShopOfferingRules = {},
): GearInstance[] {
  return generateGearOfferings({
    count,
    rng,
    rollTier: () => rules.rarity ?? rollEquipmentShopDropTier(astralChanceBonus, rng, true),
    ownedUniqueIds,
    fillFallback: true,
    basePool: rules.baseItemIds
      ? gearBaseItemList.filter((base) => rules.baseItemIds?.includes(base.id))
      : gearBaseItemList,
  });
}

export function generateGearRewardChoicesForRarity(
  count: number,
  rarity: GearRarity,
  rng: () => number,
  ownedUniqueIds: ReadonlySet<string> = new Set(),
): GearInstance[] {
  return generateGearOfferings({
    count,
    rng,
    rollTier: () => rarity,
    ownedUniqueIds,
    fallbackUniqueToAstral: false,
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

function gearBasicRarityChance(astralChanceBonus = 0): number {
  return clamp(GEAR_REWARD_RARITY_CHANCE - astralChanceBonus, 0, 1);
}

export function rollGearRewardRarity(rng: () => number, astralChanceBonus = 0): GearRarity {
  return rng() < gearBasicRarityChance(astralChanceBonus) ? "basic" : "astral";
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
  astralChanceBonus = 0,
): GearInstance | null {
  if (!(baseItemId in gearBaseItems)) return null;
  const baseItem = gearBaseItems[baseItemId as GearBaseItemId];
  const rarity = rollGearRewardRarity(rng, astralChanceBonus);
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

export function generateGearRewardChoices(
  count: number,
  rng: () => number,
  astralChanceBonus = 0,
  isBoss = false,
  ownedUniqueIds: ReadonlySet<string> = new Set(),
): GearInstance[] {
  return generateGearOfferings({
    count,
    rng,
    rollTier: () => rollItemDropTier({ isBoss, astralChanceBonus }, rng),
    ownedUniqueIds,
    fillFallback: true,
  });
}
