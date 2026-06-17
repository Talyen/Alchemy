import { GEAR_AFFIX_COUNT, GEAR_REWARD_RARITY_CHANCE } from "@/lib/game-constants";
import { createInstanceId } from "@/lib/utils";
import { rollAffixValue } from "./affixes";
import { buildEligibleAffixPool } from "./affix-pool";
import { gearBaseItemList } from "./base-items";
import { gearDefinitions, getGearDefinitionsByRarity } from "./definitions";
import type { GearAffixRoll, GearDefinition, GearInstance, GearRarity } from "./types";

export type GearGenerationOptions = {
  astralChanceBonus?: number;
};

function gearBasicRarityChance(options: GearGenerationOptions = {}): number {
  return Math.max(0, Math.min(1, GEAR_REWARD_RARITY_CHANCE - (options.astralChanceBonus ?? 0)));
}

export function rollGearRewardRarity(rng: () => number = Math.random, options: GearGenerationOptions = {}): GearRarity {
  return rng() < gearBasicRarityChance(options) ? "basic" : "astral";
}

export function rollAffixCount(rarity: GearRarity, rng: () => number = Math.random): number {
  const range = GEAR_AFFIX_COUNT[rarity];
  const span = range.max - range.min + 1;
  return range.min + Math.floor(rng() * span);
}

export function rollAffixes(
  definition: GearDefinition,
  count: number,
  rng: () => number = Math.random,
): GearAffixRoll[] {
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

export function generateDevRandomGearInstance(rng: () => number = Math.random): GearInstance {
  const baseItem = gearBaseItemList[Math.floor(rng() * gearBaseItemList.length)]!;
  const rarity = baseItem.availableRarities[Math.floor(rng() * baseItem.availableRarities.length)]!;
  const definition = gearDefinitions[`${baseItem.id}-${rarity}`]!;
  const affixCount = rollAffixCount(rarity, rng);
  const affixes = rollAffixes(definition, affixCount, rng);
  return createGearInstance(definition, affixes);
}

export function generateGearInstance(
  rng: () => number = Math.random,
  options: GearGenerationOptions = {},
): GearInstance | null {
  const rarity = rollGearRewardRarity(rng, options);
  const pool = getGearDefinitionsByRarity(rarity);
  if (pool.length === 0) return null;
  const definition = pool[Math.floor(rng() * pool.length)]!;
  const affixCount = rollAffixCount(rarity, rng);
  const affixes = rollAffixes(definition, affixCount, rng);
  return createGearInstance(definition, affixes);
}

function fullRollKey(instance: GearInstance): string {
  return `${instance.definitionId}:${instance.affixes.map((roll) => `${roll.id}=${roll.value}`).join(",")}`;
}

export function generateGearRewardChoices(
  count: number,
  rng: () => number = Math.random,
  options: GearGenerationOptions = {},
): GearInstance[] {
  const choices: GearInstance[] = [];
  const seenFullRolls = new Set<string>();
  const seenDefinitionIds = new Set<string>();

  let attempts = 0;
  const maxDistinctRollAttempts = count * 30;
  while (choices.length < count && attempts < maxDistinctRollAttempts) {
    attempts += 1;
    const instance = generateGearInstance(rng, options);
    if (!instance) continue;
    const key = fullRollKey(instance);
    if (seenFullRolls.has(key)) continue;
    seenFullRolls.add(key);
    seenDefinitionIds.add(instance.definitionId);
    choices.push(instance);
  }

  attempts = 0;
  const maxDistinctDefinitionAttempts = count * 30;
  while (choices.length < count && attempts < maxDistinctDefinitionAttempts) {
    attempts += 1;
    const instance = generateGearInstance(rng, options);
    if (!instance) continue;
    const key = fullRollKey(instance);
    if (seenFullRolls.has(key)) continue;
    if (seenDefinitionIds.has(instance.definitionId)) continue;
    seenFullRolls.add(key);
    seenDefinitionIds.add(instance.definitionId);
    choices.push(instance);
  }

  while (choices.length < count) {
    const instance = generateGearInstance(rng, options);
    if (!instance) break;
    choices.push(instance);
  }

  return choices;
}
