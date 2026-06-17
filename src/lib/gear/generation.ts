import { GEAR_AFFIX_COUNT, GEAR_REWARD_RARITY_CHANCE } from "@/lib/game-constants";
import { createInstanceId } from "@/lib/utils";
import { affixMatchesAffinity, rollAffixValue } from "./affixes";
import { gearAffixList, type GearAffixAspect, type GearAffixDefinition } from "./affix-catalog";
import { gearBaseItemList } from "./base-items";
import { gearDefinitions, getGearDefinitionsByRarity } from "./definitions";
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

export function rollGearRewardRarity(rng: () => number = Math.random, astralChanceBonus = 0): GearRarity {
  return rng() < gearBasicRarityChance(astralChanceBonus) ? "basic" : "astral";
}

export function rollAffixCount(rarity: GearRarity, rng: () => number = Math.random): number {
  const range = GEAR_AFFIX_COUNT[rarity];
  const span = range.max - range.min + 1;
  return range.min + Math.floor(rng() * span);
}

function rollAffixes(definition: GearDefinition, count: number, rng: () => number = Math.random): GearAffixRoll[] {
  const pool = buildEligibleAffixPool(definition);
  const effectiveCount = Math.min(count, pool.length);
  const selected: GearAffixRoll[] = [];
  const remaining = [...pool];

  for (let pick = 0; pick < effectiveCount && remaining.length > 0; pick += 1) {
    const chosenIndex = Math.floor(rng() * remaining.length);
    const [chosen] = remaining.splice(chosenIndex, 1);
    selected.push({ id: chosen.id, value: rollAffixValue(chosen, rng) });
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

function pickAtRandom<T>(items: readonly T[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}

export function generateDevRandomGearInstance(rng: () => number = Math.random): GearInstance {
  const baseItem = pickAtRandom(gearBaseItemList, rng);
  if (!baseItem) throw new Error("gearBaseItemList is empty");
  const rarity = pickAtRandom(baseItem.availableRarities, rng);
  if (!rarity) throw new Error(`No rarities configured for ${baseItem.id}`);
  const definition = gearDefinitions[`${baseItem.id}-${rarity}`];
  if (!definition) throw new Error(`Missing gear definition for ${baseItem.id}-${rarity}`);
  const affixCount = rollAffixCount(rarity, rng);
  const affixes = rollAffixes(definition, affixCount, rng);
  return createGearInstance(definition, affixes);
}

function generateGearInstance(rng: () => number = Math.random, astralChanceBonus = 0): GearInstance | null {
  const rarity = rollGearRewardRarity(rng, astralChanceBonus);
  const pool = getGearDefinitionsByRarity(rarity);
  if (pool.length === 0) return null;
  const definition = pickAtRandom(pool, rng);
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

export function generateGearRewardChoices(
  count: number,
  rng: () => number = Math.random,
  astralChanceBonus = 0,
): GearInstance[] {
  const choices: GearInstance[] = [];
  const seenFullRolls = new Set<string>();

  let attempts = 0;
  const maxDistinctRollAttempts = count * 30;
  while (choices.length < count && attempts < maxDistinctRollAttempts) {
    attempts += 1;
    const instance = generateGearInstance(rng, astralChanceBonus);
    if (!instance) continue;
    tryAddDistinctRoll(choices, seenFullRolls, instance);
  }

  while (choices.length < count) {
    const instance = generateGearInstance(rng, astralChanceBonus);
    if (!instance) break;
    choices.push(instance);
  }

  return choices;
}
