import { createEmptyGearInventories } from "@/lib/gear";
import type { GearInstance } from "@/lib/gear";

/** Creates per-character gear inventories with Knight carrying the given items. */
export function knightInventories(...items: GearInstance[]) {
  const inventories = createEmptyGearInventories();
  inventories.knight = items;
  return inventories;
}
