import { gearDefinitions, gearInstanceRarity } from "./definitions";
import { gearBaseItems } from "./base-items";
import { getUniqueItemDefinition } from "./unique-catalog";
import type { GearDefinition, GearInstance } from "./types";

function baseItemDisplayName(definition: GearDefinition): string {
  return gearBaseItems[definition.baseItemId].displayName;
}

export function getGearDefinitionTitle(definition: GearDefinition): string {
  const uniqueDef = getUniqueItemDefinition(definition.id);
  if (uniqueDef) return uniqueDef.displayName;
  const name = baseItemDisplayName(definition);
  return definition.rarity === "astral" ? `Astral ${name}` : name;
}

export function getGearInstanceTitle(instance: GearInstance): string {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return "Gear";

  const uniqueDef = getUniqueItemDefinition(definition.id);
  if (uniqueDef) return uniqueDef.displayName;

  const name = baseItemDisplayName(definition);
  return gearInstanceRarity(instance) === "astral" ? `Astral ${name}` : name;
}
