import { gearDefinitions } from "./definitions";
import type { GearDefinition, GearSlot } from "./types";

export interface GearFootprint {
  w: number;
  h: number;
}

export const GEAR_FOOTPRINT: Record<GearSlot, GearFootprint> = {
  helm: { w: 2, h: 2 },
  body: { w: 2, h: 3 },
  "main-hand": { w: 2, h: 3 },
  "off-hand": { w: 2, h: 3 },
  gloves: { w: 2, h: 2 },
  boots: { w: 2, h: 2 },
  belt: { w: 2, h: 1 },
  amulet: { w: 1, h: 1 },
  "left-ring": { w: 1, h: 1 },
  "right-ring": { w: 1, h: 1 },
};

export function getInventoryFootprint(definition: GearDefinition, selectedSlot: GearSlot | null): GearFootprint {
  if (selectedSlot) return GEAR_FOOTPRINT[selectedSlot];
  return GEAR_FOOTPRINT[definition.compatibleSlots[0]!];
}

export function footprintForInstance(instance: { definitionId: string }): GearFootprint | null {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return null;
  return GEAR_FOOTPRINT[definition.compatibleSlots[0]!];
}
