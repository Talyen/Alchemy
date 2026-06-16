import type { GearDefinition, GearDefinitionId, GearInstance } from "./types";
import { gearDefinitions } from "./definitions";

export function resolveGearDefinition(definitionId: string): GearDefinition | undefined {
  return gearDefinitions[definitionId as GearDefinitionId];
}

export function isArmoryLocked(inventory: GearInstance[]): boolean {
  return inventory.length === 0;
}
