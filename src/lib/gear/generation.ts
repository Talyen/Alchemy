import {
  GEAR_AFFIX_AFFINITY_WEIGHT,
  GEAR_AFFIX_BASE_WEIGHT,
  GEAR_AFFIX_COUNT,
  GEAR_RARITY_WEIGHTS,
} from "@/lib/game-constants";
import { createInstanceId } from "@/lib/utils";
import { gearAffixList } from "./affixes";
import { getGearDefinitionsByRarity } from "./definitions";
import type { GearAffixDefinition } from "./affixes";
import type { GearDefinition, GearInstance, GearRarity } from "./types";

export type GearEnemyType = "normal" | "elite" | "boss";

export function rollGearRarity(enemyType: GearEnemyType, rng: () => number = Math.random): GearRarity {
  const weights = GEAR_RARITY_WEIGHTS[enemyType];
  const roll = rng();
  return roll < weights.basic ? "basic" : "astral";
}

export function rollAffixCount(rarity: GearRarity, rng: () => number = Math.random): number {
  const range = GEAR_AFFIX_COUNT[rarity];
  const span = range.max - range.min + 1;
  return range.min + Math.floor(rng() * span);
}

function affixWeight(affix: GearAffixDefinition, definition: GearDefinition): number {
  return definition.affinityKeywords.includes(affix.keywordId) ? GEAR_AFFIX_AFFINITY_WEIGHT : GEAR_AFFIX_BASE_WEIGHT;
}

export function rollAffixes(
  definition: GearDefinition,
  count: number,
  rng: () => number = Math.random,
): GearInstance["affixIds"] {
  const pool = [...gearAffixList];
  const selected: GearInstance["affixIds"] = [];

  for (let pick = 0; pick < count && pool.length > 0; pick += 1) {
    const weights = pool.map((affix) => affixWeight(affix, definition));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = rng() * totalWeight;
    let chosenIndex = pool.length - 1;
    for (let index = 0; index < pool.length; index += 1) {
      roll -= weights[index]!;
      if (roll <= 0) {
        chosenIndex = index;
        break;
      }
    }
    const [chosen] = pool.splice(chosenIndex, 1);
    selected.push(chosen.id);
  }

  return selected;
}

export function createGearInstance(definition: GearDefinition, affixIds: GearInstance["affixIds"]): GearInstance {
  return {
    instanceId: createInstanceId(),
    definitionId: definition.id,
    affixIds,
  };
}

export function generateGearInstance(enemyType: GearEnemyType, rng: () => number = Math.random): GearInstance | null {
  const rarity = rollGearRarity(enemyType, rng);
  const pool = getGearDefinitionsByRarity(rarity);
  if (pool.length === 0) return null;
  const definition = pool[Math.floor(rng() * pool.length)]!;
  const affixCount = rollAffixCount(rarity, rng);
  const affixIds = rollAffixes(definition, affixCount, rng);
  return createGearInstance(definition, affixIds);
}

function fullRollKey(instance: GearInstance): string {
  return `${instance.definitionId}:${instance.affixIds.join(",")}`;
}

export function generateGearRewardChoices(
  count: number,
  enemyType: GearEnemyType,
  rng: () => number = Math.random,
): GearInstance[] {
  const choices: GearInstance[] = [];
  const seenFullRolls = new Set<string>();
  const seenDefinitionIds = new Set<string>();

  let attempts = 0;
  const maxDistinctRollAttempts = count * 30;
  while (choices.length < count && attempts < maxDistinctRollAttempts) {
    attempts += 1;
    const instance = generateGearInstance(enemyType, rng);
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
    const instance = generateGearInstance(enemyType, rng);
    if (!instance) continue;
    const key = fullRollKey(instance);
    if (seenFullRolls.has(key)) continue;
    if (seenDefinitionIds.has(instance.definitionId)) continue;
    seenFullRolls.add(key);
    seenDefinitionIds.add(instance.definitionId);
    choices.push(instance);
  }

  while (choices.length < count) {
    const instance = generateGearInstance(enemyType, rng);
    if (!instance) break;
    choices.push(instance);
  }

  return choices;
}
