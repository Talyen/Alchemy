import { GEAR_FOOTPRINT, type GearDefinition } from "@/lib/gear";

/** Static Tailwind classes only — dynamic `aspect-[${w}/${h}]` is not scanned into CSS. */
const FOOTPRINT_ASPECT_CLASS: Record<string, string> = {
  "1x1": "aspect-square",
  "2x2": "aspect-square",
  "2x3": "aspect-[2/3]",
  "2x1": "aspect-[2/1]",
};

export function gearInstanceAspectClass(definition: GearDefinition | undefined): string {
  if (!definition) return "aspect-square";
  const firstSlot = definition.compatibleSlots[0];
  if (!firstSlot) return "aspect-square";
  const footprint = GEAR_FOOTPRINT[firstSlot];
  return FOOTPRINT_ASPECT_CLASS[`${footprint.w}x${footprint.h}`] ?? "aspect-square";
}
