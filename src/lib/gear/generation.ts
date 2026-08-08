import { GEAR_AFFIX_COUNT, GEAR_AFFIX_COUNT_MIN_WEIGHT, GEAR_REWARD_RARITY_CHANCE } from "@/lib/game-constants";
import { createInstanceId, pickRandom } from "@/lib/utils";
import { affixMatchesAffinity, rollAffixValue } from "./affixes";
import { gearAffixList, type GearAffixAspect, type GearAffixDefinition } from "./affix-catalog";
import { gearBaseItemList } from "./base-items";
import { gearDefinitions, getGearDefinitionsByRarity } from "./definitions";
import { definitionOfferFootprintKey, eligibleOfferFootprintKeys, type GearOfferFootprintKey } from "./footprints";
import type { GearAffixRoll, GearDefinition, GearInstance, GearRarity, GearSlot } from "./types";

const SHIELD_BASE_ITEM_IDS = new Set(["leather-buckler", "kite-shield"]);
const OFF_HAND_OFFENSIVE_BASE_ITEMS = new Set(["quiver", "spellbook"]);
const JEWELRY_SLOTS = new Set<GearSlot>(["left-ring", "right-ring", "amulet"]);
const ARMOR_SLOTS = new Set<GearSlot>(["body", "helm", "boots", "gloves", "belt"]);

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
  if (def.compatibleSlots.some((slot) => ARMOR_SLOTS.has(slot))) {
    return ["defensive"];
  }
  return ["defensive"];
}

export function buildEligibleAffixPool(definition: GearDefinition): GearAffixDefinition[] {
  const allowedAspects = new Set(allowedAspectsForDefinition(definition));
  return gearAffixList.filter(
    (affix) => allowedAspects.has(affix.aspect) && affixMatchesAffinity(affix, definition.affinityKeywords),
  );
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

function rollAffixes(definition: GearDefinition, count: number, rng: () => number): GearAffixRoll[] {
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

export function generateDevRandomGearInstance(rng: () => number): GearInstance {
  const baseItem = pickRandom(gearBaseItemList, rng);
  if (!baseItem) throw new Error("gearBaseItemList is empty");
  const rarity = pickRandom(baseItem.availableRarities, rng);
  if (!rarity) throw new Error(`No rarities configured for ${baseItem.id}`);
  const definition = gearDefinitions[`${baseItem.id}-${rarity}`];
  if (!definition) throw new Error(`Missing gear definition for ${baseItem.id}-${rarity}`);
  const affixCount = rollAffixCount(rarity, rng);
  const affixes = rollAffixes(definition, affixCount, rng);
  return createGearInstance(definition, affixes);
}

function generateGearInstance(
  rng: () => number,
  astralChanceBonus = 0,
  footprintKey: GearOfferFootprintKey | null = null,
): GearInstance | null {
  const rarity = rollGearRewardRarity(rng, astralChanceBonus);
  let pool = getGearDefinitionsByRarity(rarity);
  if (footprintKey) {
    pool = pool.filter((definition) => definitionOfferFootprintKey(definition) === footprintKey);
  }
  if (pool.length === 0) return null;
  const definition = pickRandom(pool, rng);
  if (!definition) return null;
  const affixCount = rollAffixCount(rarity, rng);
  const affixes = rollAffixes(definition, affixCount, rng);
  return createGearInstance(definition, affixes);
}

function fullRollKey(instance: GearInstance): string {
  return `${instance.definitionId}:${instance.affixes.map((roll) => `${roll.id}=${roll.value}`).join(",")}`;
}

function tryAddDistinctRoll(choices: GearInstance[], seenFullRolls: Set<string>, instance: GearInstance): boolean {
  const key = fullRollKey(instance);
  if (seenFullRolls.has(key)) return false;
  seenFullRolls.add(key);
  choices.push(instance);
  return true;
}

export function generateGearRewardChoices(count: number, rng: () => number, astralChanceBonus = 0): GearInstance[] {
  const choices: GearInstance[] = [];
  const seenFullRolls = new Set<string>();
  const seenBaseItemIds = new Set<string>();
  const eligibleFamilies = eligibleOfferFootprintKeys(count);
  const footprintKey = eligibleFamilies.length > 0 ? (pickRandom(eligibleFamilies, rng) ?? null) : null;

  let attempts = 0;
  const maxDistinctRollAttempts = count * 30;
  while (choices.length < count && attempts < maxDistinctRollAttempts) {
    attempts += 1;
    const instance = generateGearInstance(rng, astralChanceBonus, footprintKey);
    if (!instance) continue;
    const def = gearDefinitions[instance.definitionId];
    if (!def || seenBaseItemIds.has(def.baseItemId)) continue;
    seenBaseItemIds.add(def.baseItemId);
    tryAddDistinctRoll(choices, seenFullRolls, instance);
  }

  while (choices.length < count) {
    const instance = generateGearInstance(rng, astralChanceBonus, footprintKey);
    if (!instance) break;
    choices.push(instance);
  }

  return choices;
}
