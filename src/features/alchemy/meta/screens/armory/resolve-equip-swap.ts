import {
  canOccupyVacatedInventoryPlacement,
  footprintForInstance,
  INVENTORY_COLS,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
  type InventoryPlacement,
  type PackedInventoryItem,
} from "@/lib/gear";

export function resolveEquipSwap({
  loadout,
  slot,
  instance,
  vacatedPlacement,
  inventoryById,
  packedItems,
}: {
  loadout: GearLoadout;
  slot: GearSlot;
  instance: GearInstance;
  vacatedPlacement: InventoryPlacement;
  inventoryById: Map<string, GearInstance>;
  packedItems: PackedInventoryItem<GearInstance>[];
}): { canSwap: boolean; displaced: GearInstance | null } {
  const displacedId = loadout[slot];
  if (!displacedId || displacedId === instance.instanceId) {
    return { canSwap: false, displaced: null };
  }

  const displaced = inventoryById.get(displacedId) ?? null;
  const incomingFootprint = footprintForInstance(instance);
  const displacedFootprint = displaced ? footprintForInstance(displaced) : null;
  const canSwap =
    !!displaced &&
    !!incomingFootprint &&
    !!displacedFootprint &&
    canOccupyVacatedInventoryPlacement(
      packedItems,
      instance.instanceId,
      incomingFootprint,
      displacedFootprint,
      vacatedPlacement,
      INVENTORY_COLS,
    );

  return { canSwap, displaced: canSwap ? displaced : null };
}
