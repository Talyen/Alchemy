import { gearDefinitionList } from "./definitions";
import type { GearDefinition } from "./types";

export interface GearFootprint {
  w: number;
  h: number;
}

/** Stable key for grouping offer rows that share the same tile aspect ratio. */
export type GearOfferFootprintKey = `${number}x${number}`;

/** All remaining gear uses portrait 3:4 frames. */
export const GEAR_PORTRAIT_FOOTPRINT: GearFootprint = { w: 3, h: 4 };
export const GEAR_PORTRAIT_FOOTPRINT_KEY: GearOfferFootprintKey = "3x4";

export function definitionOfferFootprintKey(_definition: GearDefinition): GearOfferFootprintKey {
  return GEAR_PORTRAIT_FOOTPRINT_KEY;
}

export function eligibleOfferFootprintKeys(minBaseItems: number): GearOfferFootprintKey[] {
  const baseIds = new Set(gearDefinitionList.map((definition) => definition.baseItemId));
  return baseIds.size >= minBaseItems ? [GEAR_PORTRAIT_FOOTPRINT_KEY] : [];
}
