import {
  canEquipInOffHand,
  findFirstInventoryPlacement,
  footprintForInstance,
  INVENTORY_COLS,
  inventoryPlacementRect,
  isGearCompatibleWithLoadoutSlot,
  isTwoHanded,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
  type InventoryPlacement,
  type PackedInventoryItem,
  type GearDefinition,
} from "@/lib/gear";
import { readInventoryBoardMetrics } from "./read-inventory-board-metrics";
import { resolveEquipSwap } from "./resolve-equip-swap";
import type { DragDestination, DragRect, DragPoint } from "./use-board-drag";

export function findEquipSlotForDoubleClickedGear(loadout: GearLoadout, definition: GearDefinition): GearSlot | null {
  const compatibleSlots = definition.compatibleSlots;
  let slot = compatibleSlots.find((candidate) => !loadout[candidate]) ?? null;
  if (!slot) {
    if (
      !isTwoHanded(definition) &&
      !!loadout["main-hand"] &&
      !loadout["off-hand"] &&
      compatibleSlots.includes("off-hand") &&
      canEquipInOffHand(definition)
    ) {
      slot = "off-hand";
    } else {
      slot = compatibleSlots[0] ?? null;
    }
  }
  return slot;
}

export function resolveEquipmentSlotAtPointer({
  pointer,
  activeInstance,
  loadout,
  inventoryById,
  gearDefinitions,
  equipmentSnapInsetRatio,
}: {
  pointer: DragPoint;
  activeInstance: GearInstance | null;
  loadout: GearLoadout;
  inventoryById: Map<string, GearInstance>;
  gearDefinitions: Record<string, GearDefinition>;
  equipmentSnapInsetRatio: number;
}): DragDestination | null {
  if (!activeInstance) return null;
  const definition = gearDefinitions[activeInstance.definitionId];
  if (!definition) return null;

  const element = document.elementFromPoint(pointer.x, pointer.y);
  const slotElement = element?.closest<HTMLElement>("[data-testid='armory-equipment-slot']");
  const slot = slotElement?.dataset.slot as GearSlot | undefined;
  const inventoryList = Array.from(inventoryById.values());

  if (slotElement && slot && isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventoryList)) {
    const rect = slotElement.getBoundingClientRect();
    const insetX = rect.width * equipmentSnapInsetRatio;
    const insetY = rect.height * equipmentSnapInsetRatio;
    if (
      pointer.x >= rect.left + insetX &&
      pointer.x <= rect.right - insetX &&
      pointer.y >= rect.top + insetY &&
      pointer.y <= rect.bottom - insetY
    ) {
      return { kind: "equipment", slot, rect };
    }
  }

  const allSlots = document.querySelectorAll<HTMLElement>("[data-testid='armory-equipment-slot']");
  let bestSlot: { slot: GearSlot; rect: DOMRect } | null = null;
  let bestDistance = 48;
  for (const el of allSlots) {
    const candidateSlot = el.dataset.slot as GearSlot | undefined;
    if (!candidateSlot || !isGearCompatibleWithLoadoutSlot(definition, candidateSlot, loadout, inventoryList)) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(pointer.x - cx, pointer.y - cy);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestSlot = { slot: candidateSlot, rect: r };
    }
  }

  if (bestSlot) {
    return { kind: "equipment", slot: bestSlot.slot, rect: bestSlot.rect };
  }

  return null;
}

export function getInventoryDragDestination({
  board,
  instance,
  boardObstacles,
}: {
  board: HTMLElement;
  instance: GearInstance;
  boardObstacles: PackedInventoryItem<{ instanceId: string }>[];
}): { kind: "inventory"; placement: InventoryPlacement; rect: DragRect } | null {
  const metrics = readInventoryBoardMetrics(board);
  const footprint = footprintForInstance(instance);
  if (!metrics || !footprint) return null;
  const { cellSize, gap, boardRect, scrollTop } = metrics;
  const placement = findFirstInventoryPlacement(boardObstacles, instance.instanceId, footprint, INVENTORY_COLS);
  const localRect = inventoryPlacementRect(placement, footprint, { cellSize, gap });
  return {
    kind: "inventory",
    placement,
    rect: {
      left: boardRect.left + localRect.left,
      top: boardRect.top + localRect.top - scrollTop,
      width: localRect.width,
      height: localRect.height,
    },
  };
}

export function calculateSecondaryDisplacedItems({
  instance,
  slot,
  slotRect,
  vacatedPlacement,
  loadout,
  inventoryById,
  packedItems,
}: {
  instance: GearInstance;
  slot: GearSlot;
  slotRect: DragRect;
  vacatedPlacement: InventoryPlacement;
  loadout: GearLoadout;
  inventoryById: Map<string, GearInstance>;
  packedItems: PackedInventoryItem[];
}): { instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement }[] {
  const { displaced } = resolveEquipSwap({
    loadout,
    slot,
    instance,
    vacatedPlacement,
    inventoryById,
    packedItems,
  });
  const toAnimate: { instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement }[] = [];
  if (displaced) {
    toAnimate.push({ instance: displaced, source: slotRect, vacatedPlacement });
  }
  const otherSlot: GearSlot | null = slot === "main-hand" ? "off-hand" : slot === "off-hand" ? "main-hand" : null;
  if (otherSlot) {
    const otherInstanceId = loadout[otherSlot];
    if (otherInstanceId && otherInstanceId !== instance.instanceId && otherInstanceId !== displaced?.instanceId) {
      const otherInstance = inventoryById.get(otherInstanceId);
      if (otherInstance) {
        const otherSlotEl = document.querySelector<HTMLElement>(
          `[data-testid='armory-equipment-slot'][data-slot='${otherSlot}']`,
        );
        const otherSource: DragRect = otherSlotEl ? otherSlotEl.getBoundingClientRect() : slotRect;
        toAnimate.push({ instance: otherInstance, source: otherSource, vacatedPlacement });
      }
    }
  }
  return toAnimate;
}

export type SecondaryDragVisual = {
  instance: GearInstance;
  source: DragRect;
  rect: DragRect;
  origin: { kind: "inventory"; placement: InventoryPlacement };
  destination: DragDestination;
  flyover: boolean;
};

export function buildSecondaryDragVisuals({
  board,
  displacedItems,
}: {
  board: HTMLElement;
  displacedItems: { instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement }[];
}): SecondaryDragVisual[] {
  const metrics = readInventoryBoardMetrics(board);
  if (!metrics) return [];
  const { cellSize, gap, boardRect, scrollTop } = metrics;

  const visuals: SecondaryDragVisual[] = [];
  for (const { instance: displaced, source, vacatedPlacement } of displacedItems) {
    const footprint = footprintForInstance(displaced);
    if (!footprint) continue;
    const localRect = inventoryPlacementRect(vacatedPlacement, footprint, { cellSize, gap });
    const destinationRect: DragRect = {
      left: boardRect.left + localRect.left,
      top: boardRect.top + localRect.top - scrollTop,
      width: localRect.width,
      height: localRect.height,
    };
    visuals.push({
      instance: displaced,
      source,
      rect: destinationRect,
      origin: { kind: "inventory", placement: vacatedPlacement },
      destination: { kind: "inventory", placement: vacatedPlacement, rect: destinationRect },
      flyover: true,
    });
  }
  return visuals;
}
