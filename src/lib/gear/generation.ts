import {
  DROP_RATES_BOSS,
  DROP_RATES_NORMAL,
  EQUIPMENT_SHOP_DROP_RATES,
  GEAR_AFFIX_COUNT,
  GEAR_AFFIX_COUNT_MIN_WEIGHT,
  GEAR_REWARD_RARITY_CHANCE,
} from "@/lib/game-constants";
import { createInstanceId, pickRandom, sampleItems } from "@/lib/utils";
import { affixMatchesAffinity, rollAffixValue } from "./affixes";
import { gearAffixList, type GearAffixAspect, type GearAffixDefinition } from "./affix-catalog";
import { gearBaseItemList, gearBaseItems, type GearBaseItemId } from "./base-items";
import { gearDefinitionId, gearDefinitions, getGearDefinitionsByRarity } from "./definitions";
import { GEAR_RARITIES, type ItemDropTier } from "./types-core";
import { uniqueItemList, type UniqueItemDefinition } from "./unique-catalog";
import type { GearAffixRoll, GearDefinition, GearInstance, GearRarity, GearSlot } from "./types";

const SHIELD_BASE_ITEM_IDS = new Set(["leather-buckler", "kite-shield"]);
const OFF_HAND_OFFENSIVE_BASE_ITEMS = new Set(["quiver", "spellbook"]);
const JEWELRY_SLOTS = new Set<GearSlot>(["left-accessory", "right-accessory"]);

function allowedAspectsForDefinition(def: GearDefinition): GearAffixAspect[] {
  if (SHIELD_BASE_ITEM_IDS.has(def.baseItemId)) {
    return ["offensive", "defensive"];
  }
  if (def.compatibleSlots.some((slot) => JEWELRY_SLOTS.has(slot))) {
    return ["offensive", "defensive"];
  }
  if (def.compatibleSlots.includes("main-hand")) {
    return ["offensive"];
  }
  if (def.compatibleSlots.includes("off-hand") && OFF_HAND_OFFENSIVE_BASE_ITEMS.has(def.baseItemId)) {
    return ["offensive"];
  }
  return ["defensive"];
}

const eligibleAffixPoolCache = new Map<string, GearAffixDefinition[]>();

export function buildEligibleAffixPool(definition: GearDefinition): GearAffixDefinition[] {
  if (definition.id) {
    const cached = eligibleAffixPoolCache.get(definition.id);
    if (cached) return cached;
  }
  const allowedAspects = new Set(allowedAspectsForDefinition(definition));
  const pool = gearAffixList.filter(
    (affix) =>
      !affix.uniqueOnly && allowedAspects.has(affix.aspect) && affixMatchesAffinity(affix, definition.affinityKeywords),
  );
  if (definition.id) {
    eligibleAffixPoolCache.set(definition.id, pool);
  }
  return pool;
}

export function generateUniqueGearInstance(uniqueDef: UniqueItemDefinition): GearInstance {
  return {
    instanceId: createInstanceId(),
    definitionId: uniqueDef.id,
    affixes: [uniqueDef.signatureAffix, ...uniqueDef.supportingAffixes],
  };
}

function takeUnusedBaseItem(
  remaining: Array<(typeof gearBaseItemList)[number]>,
  usedIds: Set<string>,
  rng: () => number,
): (typeof gearBaseItemList)[number] | undefined {
  const sampledIndex = remaining.findIndex((item) => !usedIds.has(item.id));
  if (sampledIndex >= 0) {
    const [item] = remaining.splice(sampledIndex, 1);
    if (item) usedIds.add(item.id);
    return item;
  }
  const picked = pickRandom(
    gearBaseItemList.filter((item) => !usedIds.has(item.id)),
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
): GearInstance | null {
  const availableUniques = uniqueItemList.filter(
    (unique) =>
      !ownedUniqueIds.has(unique.id) && !offeredUniqueIds.has(unique.id) && !usedBaseIds.has(unique.baseItemId),
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
  allowsTrinket?: boolean;
  astralChanceBonus?: number;
}

function rollItemDropTier(options: RollItemDropTierOptions, rng: () => number): ItemDropTier {
  const allowsUnique = options.allowsUnique !== false;
  const allowsTrinket = options.allowsTrinket !== false;
  const astralBonus = Math.max(0, options.astralChanceBonus ?? 0);

  if (options.isBoss) {
    const uniqueChance = allowsUnique ? DROP_RATES_BOSS.unique : 0;
    const trinketChance = allowsTrinket ? DROP_RATES_BOSS.trinket : 0;

    const draw = rng();
    if (draw < uniqueChance) return "unique";
    if (draw < uniqueChance + trinketChance) return "trinket";
    return "astral";
  }

  const uniqueChance = allowsUnique ? DROP_RATES_NORMAL.unique : 0;
  const trinketChance = allowsTrinket ? DROP_RATES_NORMAL.trinket : 0;
  let astralChance = DROP_RATES_NORMAL.astral + astralBonus;
  if (!allowsUnique) astralChance += DROP_RATES_NORMAL.unique;

  const draw = rng();
  if (draw < uniqueChance) return "unique";
  if (draw < uniqueChance + trinketChance) return "trinket";
  if (draw < uniqueChance + trinketChance + astralChance) return "astral";
  return "basic";
}

function rollEquipmentShopDropTier(astralChanceBonus = 0, rng: () => number, allowsUnique = true): GearRarity {
  const uniqueChance = allowsUnique ? EQUIPMENT_SHOP_DROP_RATES.unique : 0;
  const astralBonus = Math.max(0, astralChanceBonus);
  const astralChance =
    EQUIPMENT_SHOP_DROP_RATES.astral + astralBonus + (allowsUnique ? 0 : EQUIPMENT_SHOP_DROP_RATES.unique);

  const draw = rng();
  if (draw < uniqueChance) return "unique";
  if (draw < uniqueChance + astralChance) return "astral";
  return "basic";
}

interface GenerateGearOfferingsOptions {
  count: number;
  rng: () => number;
  rollTier: () => "unique" | "astral" | "basic";
  ownedUniqueIds?: ReadonlySet<string>;
  fillFallback?: boolean;
  astralChanceBonus?: number;
  isBoss?: boolean;
}

function generateGearOfferings({
  count,
  rng,
  rollTier,
  ownedUniqueIds = new Set(),
  fillFallback = false,
  astralChanceBonus = 0,
  isBoss = false,
}: GenerateGearOfferingsOptions): GearInstance[] {
  const offeredUniqueIds = new Set<string>();
  const usedBaseIds = new Set<string>();
  const remainingBases = sampleItems(gearBaseItemList, count, rng);
  const choices: GearInstance[] = [];

  for (let index = 0; index < count; index += 1) {
    let tier = rollTier();

    if (tier === "unique") {
      const uniqueInstance = tryOfferUnique(ownedUniqueIds, offeredUniqueIds, usedBaseIds, remainingBases, rng);
      if (uniqueInstance) {
        choices.push(uniqueInstance);
        continue;
      }
      tier = "astral";
    }

    const rarity: GearRarity = tier === "basic" ? "basic" : "astral";
    const baseItem = takeUnusedBaseItem(remainingBases, usedBaseIds, rng);
    if (!baseItem) break;
    const definition = gearDefinitions[gearDefinitionId(baseItem.id, rarity)];
    if (definition) {
      choices.push(rollAndCreateInstance(definition, rarity, rng));
    }
  }

  if (fillFallback) {
    let fillAttempts = 0;
    while (choices.length < count && fillAttempts < count * 8) {
      fillAttempts += 1;
      const instance = generateGearInstance(rng, astralChanceBonus, isBoss);
      if (!instance) break;
      const baseItemId = gearDefinitions[instance.definitionId]?.baseItemId;
      if (baseItemId && usedBaseIds.has(baseItemId)) continue;
      if (baseItemId) usedBaseIds.add(baseItemId);
      choices.push(instance);
    }
  }

  return choices;
}

export function generateEquipmentShopOfferings(
  count: number,
  rng: () => number,
  astralChanceBonus = 0,
  ownedUniqueIds: ReadonlySet<string> = new Set(),
): GearInstance[] {
  return generateGearOfferings({
    count,
    rng,
    rollTier: () => rollEquipmentShopDropTier(astralChanceBonus, rng, true),
    ownedUniqueIds,
  });
}

function gearBasicRarityChance(astralChanceBonus = 0): number {
  return Math.max(0, Math.min(1, GEAR_REWARD_RARITY_CHANCE - astralChanceBonus));
}

export function rollGearRewardRarity(rng: () => number, astralChanceBonus = 0): GearRarity {
  return rng() < gearBasicRarityChance(astralChanceBonus) ? "basic" : "astral";
}

export function rollAffixCount(rarity: GearRarity, rng: () => number): number {
  const range = GEAR_AFFIX_COUNT[rarity];
  if (range.max <= range.min) return range.min;
  return rng() < GEAR_AFFIX_COUNT_MIN_WEIGHT ? range.min : range.max;
}

export function rollAffixes(definition: GearDefinition, count: number, rng: () => number): GearAffixRoll[] {
  const pool = buildEligibleAffixPool(definition);
  const effectiveCount = Math.min(count, pool.length);
  const selected: GearAffixRoll[] = [];
  const remaining = [...pool];
  const rarity = definition.rarity ?? "basic";

  for (let pick = 0; pick < effectiveCount && remaining.length > 0; pick += 1) {
    const chosenIndex = Math.floor(rng() * remaining.length);
    const [chosen] = remaining.splice(chosenIndex, 1);
    if (!chosen) break;
    selected.push({ id: chosen.id, value: rollAffixValue(chosen, rarity, rng) });
  }

  return selected;
}

export function createGearInstance(definition: GearDefinition, affixes: GearAffixRoll[]): GearInstance {
  return {
    instanceId: createInstanceId(),
    definitionId: definition.id,
    affixes,
  };
}

/** Shared generation tail: roll affix count for the rarity, roll affixes, build the instance. */
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

function generateGearInstance(rng: () => number, astralChanceBonus = 0, isBoss = false): GearInstance | null {
  const rarity: GearRarity = isBoss ? "astral" : rollGearRewardRarity(rng, astralChanceBonus);
  const pool = getGearDefinitionsByRarity(rarity);
  if (pool.length === 0) return null;
  const definition = pickRandom(pool, rng);
  if (!definition) return null;
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
    rollTier: () => {
      const tier = rollItemDropTier({ isBoss, allowsTrinket: false, astralChanceBonus }, rng);
      if (tier === "unique") return "unique";
      return tier === "basic" && !isBoss ? "basic" : "astral";
    },
    ownedUniqueIds,
    fillFallback: true,
    astralChanceBonus,
    isBoss,
  });
}
