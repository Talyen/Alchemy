import { gearDefinitions } from "./definitions";
import { gearBaseItems } from "./base-items";
import { gearAffixCatalog } from "./affix-catalog";
import type { GearDefinition, GearInstance } from "./types";

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function pickFromPool<T>(pool: T[], seed: number): T | undefined {
  if (pool.length === 0) return undefined;
  return pool[seed % pool.length];
}

function resolveBaseDisplayName(definition: GearDefinition): string {
  const baseItem = gearBaseItems[definition.baseItemId as keyof typeof gearBaseItems];
  return baseItem?.displayName ?? definition.title;
}

export function getGearDefinitionTitle(definition: GearDefinition): string {
  return resolveBaseDisplayName(definition);
}

export function getGearInstanceTitle(instance: GearInstance): string {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return "Gear";

  const baseName = resolveBaseDisplayName(definition);
  if (instance.affixes.length === 0) return baseName;

  const prefixPool: string[] = [];
  const suffixPool: string[] = [];

  for (const roll of instance.affixes) {
    const nameParts = gearAffixCatalog[roll.id]?.nameParts;
    if (!nameParts) continue;
    if (nameParts.prefix) prefixPool.push(nameParts.prefix);
    if (nameParts.suffix) suffixPool.push(nameParts.suffix);
  }

  const seed = hashString(instance.instanceId);
  const prefix = pickFromPool(prefixPool, seed);
  const suffix = pickFromPool(suffixPool, seed + 1);

  if (prefix && suffix) return `${prefix} ${baseName} of ${suffix}`;
  if (prefix) return `${prefix} ${baseName}`;
  if (suffix) return `${baseName} of ${suffix}`;
  return baseName;
}
