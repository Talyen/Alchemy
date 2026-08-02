import { gearDefinitionList, gearDefinitions } from "./definitions";
import type { GearDefinition, GearSlot } from "./types";

export interface GearFootprint {
  w: number;
  h: number;
}

/** Stable key for grouping offer rows that share the same tile aspect ratio. */
export type GearOfferFootprintKey = `${number}x${number}`;

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

function footprintKey(footprint: GearFootprint): GearOfferFootprintKey {
  return `${footprint.w}x${footprint.h}`;
}

export function definitionOfferFootprintKey(definition: GearDefinition): GearOfferFootprintKey {
  const slot = definition.compatibleSlots[0];
  if (!slot) return "1x1";
  return footprintKey(GEAR_FOOTPRINT[slot]);
}

/**
 * Footprint families with enough distinct base items to fill an offer row
 * without mixing aspect ratios (e.g. belt `2x1` is excluded while it has only one base).
 */
export function eligibleOfferFootprintKeys(minBaseItems: number): GearOfferFootprintKey[] {
  const baseIdsByFootprint = new Map<GearOfferFootprintKey, Set<string>>();
  for (const definition of gearDefinitionList) {
    const key = definitionOfferFootprintKey(definition);
    let baseIds = baseIdsByFootprint.get(key);
    if (!baseIds) {
      baseIds = new Set();
      baseIdsByFootprint.set(key, baseIds);
    }
    baseIds.add(definition.baseItemId);
  }

  return [...baseIdsByFootprint.entries()]
    .filter(([, baseIds]) => baseIds.size >= minBaseItems)
    .map(([key]) => key)
    .sort();
}

export function getInventoryFootprint(definition: GearDefinition, selectedSlot: GearSlot | null): GearFootprint {
  if (selectedSlot) return GEAR_FOOTPRINT[selectedSlot];
  return GEAR_FOOTPRINT[definition.compatibleSlots[0]!];
}

export function footprintForInstance(instance: { definitionId: string }): GearFootprint | null {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return null;
  return GEAR_FOOTPRINT[definition.compatibleSlots[0]!];
}
