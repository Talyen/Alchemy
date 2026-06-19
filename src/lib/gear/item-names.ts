import { gearDefinitions, gearInstanceRarity } from "./definitions";
import { gearBaseItems } from "./base-items";
import type { GearDefinition, GearInstance } from "./types";

function resolveBaseDisplayName(definition: GearDefinition): string {
  const baseItem = gearBaseItems[definition.baseItemId];
  return baseItem.displayName ?? definition.title;
}

export function getGearInstanceTitle(instance: GearInstance): string {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return "Gear";

  const baseName = resolveBaseDisplayName(definition);
  return gearInstanceRarity(instance) === "astral" ? `Astral ${baseName}` : baseName;
}
