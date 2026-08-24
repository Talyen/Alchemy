import { GEAR_AFFIX_COUNT, GEAR_AFFIX_COUNT_MIN_WEIGHT, GEAR_REWARD_RARITY_CHANCE } from "@/lib/game-constants";
import { createInstanceId, pickRandom, sampleItems } from "@/lib/utils";
import { affixMatchesAffinity, rollAffixValue } from "./affixes";
import { gearAffixList, type GearAffixAspect, type GearAffixDefinition } from "./affix-catalog";
import { gearBaseItemList, gearBaseItems, type GearBaseItemId } from "./base-items";
import { gearDefinitionId, gearDefinitions, getGearDefinitionsByRarity } from "./definitions";
import { GEAR_RARITIES } from "./types-core";
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
    (affix) => allowedAspects.has(affix.aspect) && affixMatchesAffinity(affix, definition.affinityKeywords),
  );
  if (definition.id) {
    eligibleAffixPoolCache.set(definition.id, pool);
  }
  return pool;
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
  const baseItem = pickRandom(gearBaseItemList, rng);
  if (!baseItem) throw new Error("gearBaseItemList is empty");
  const rarity = pickRandom(GEAR_RARITIES, rng) ?? "basic";
  const definition = gearDefinitions[gearDefinitionId(baseItem.id, rarity)];
  if (!definition) throw new Error(`Missing gear definition for ${baseItem.id}-${rarity}`);
  return rollAndCreateInstance(definition, rarity, rng);
}

function generateGearInstance(rng: () => number, astralChanceBonus = 0): GearInstance | null {
  const rarity = rollGearRewardRarity(rng, astralChanceBonus);
  const pool = getGearDefinitionsByRarity(rarity);
  if (pool.length === 0) return null;
  const definition = pickRandom(pool, rng);
  if (!definition) return null;
  return rollAndCreateInstance(definition, rarity, rng);
}

export function generateGearRewardChoices(count: number, rng: () => number, astralChanceBonus = 0): GearInstance[] {
  const chosenBaseItems = sampleItems(gearBaseItemList, count, rng);
  const choices: GearInstance[] = [];

  for (const baseItem of chosenBaseItems) {
    const instance = generateGearInstanceForBaseItem(baseItem.id, rng, astralChanceBonus);
    if (instance) {
      choices.push(instance);
    }
  }

  while (choices.length < count) {
    const instance = generateGearInstance(rng, astralChanceBonus);
    if (!instance) break;
    choices.push(instance);
  }

  return choices;
}
