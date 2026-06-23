import { GEAR_FOOTPRINT, type GearDefinition } from "@/lib/gear";

export function gearInstanceAspectClass(definition: GearDefinition | undefined): string {
  if (!definition) return "aspect-square";
  const firstSlot = definition.compatibleSlots[0];
  if (!firstSlot) return "aspect-square";
  const footprint = GEAR_FOOTPRINT[firstSlot];
  if (footprint.h === footprint.w) return "aspect-square";
  return `aspect-[${footprint.w}/${footprint.h}]`;
}
