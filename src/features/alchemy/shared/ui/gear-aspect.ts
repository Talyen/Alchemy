import type { GearDefinition } from "@/lib/gear";

import { gearArtAspectClass } from "../config/layout";

/** Shop, reward, and collection gear frames match portrait art (3:4), not grid footprints. */
export function gearInstanceAspectClass(_definition: GearDefinition | undefined): string {
  return gearArtAspectClass;
}
