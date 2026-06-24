import {
  canEquipInOffHand,
  findFirstInventoryPlacement,
  footprintForInstance,
  INVENTORY_COLS,
  inventoryPlacementRect,
  isGearCompatibleWithLoadoutSlot,
  isTwoHanded,
  gearDefinitions,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
  type InventoryPlacement,
  type PackedInventoryItem,
  type GearDefinition,
} from "@/lib/gear";
import { readInventoryBoardMetrics } from "./read-inventory-board-metrics";
import { resolveEquipSwap } from "./resolve-equip-swap";
import type { DragDestination, DragPoint, DragRect } from "./drag-types";

function inventoryCellDragRect({
  board,
  placement,
  footprint,
  metrics,
}: {
  board: HTMLElement;
  placement: InventoryPlacement;
  footprint: { w: number; h: number };
  metrics: NonNullable<ReturnType<typeof readInventoryBoardMetrics>>;
}): DragRect {
  const { cellSize, gap, boardRect, scrollTop } = metrics;
  const cell = board.querySelector<HTMLElement>(`[data-armory-inventory-cell="${placement.col}-${placement.row}"]`);
  const width = cellSize * footprint.w + gap * (footprint.w - 1);
  const height = cellSize * footprint.h + gap * (footprint.h - 1);
  if (cell) {
    const cellRect = cell.getBoundingClientRect();
    return {
      left: cellRect.left,
      top: cellRect.top,
      width,
      height,
    };
  }
  const localRect = inventoryPlacementRect(placement, footprint, { cellSize, gap });
  return {
    left: boardRect.left + localRect.left,
    top: boardRect.top + localRect.top - scrollTop,
    width: localRect.width,
    height: localRect.height,
  };
}

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

function findSlotUnderPointer(
  pointer: DragPoint,
  definition: GearDefinition,
  loadout: GearLoadout,
  inventoryList: GearInstance[],
  snapInsetRatio: number,
): { slot: GearSlot; rect: DOMRect } | null {
  const element = document.elementFromPoint(pointer.x, pointer.y);
  const slotEl = element?.closest<HTMLElement>("[data-testid='armory-equipment-slot']");
  const slot = slotEl?.dataset.slot as GearSlot | undefined;
  if (!slotEl || !slot || !isGearCompatibleWithLoadoutSlot(definition, slot, loadout, inventoryList)) return null;
  const rect = slotEl.getBoundingClientRect();
  const insetX = rect.width * snapInsetRatio;
  const insetY = rect.height * snapInsetRatio;
  if (pointer.x < rect.left + insetX || pointer.x > rect.right - insetX) return null;
  if (pointer.y < rect.top + insetY || pointer.y > rect.bottom - insetY) return null;
  return { slot, rect };
}

function findNearestCompatibleSlot(
  pointer: DragPoint,
  definition: GearDefinition,
  loadout: GearLoadout,
  inventoryList: GearInstance[],
): { slot: GearSlot; rect: DOMRect } | null {
  const slots = document.querySelectorAll<HTMLElement>("[data-testid='armory-equipment-slot']");
  let best: { slot: GearSlot; rect: DOMRect } | null = null;
  let bestDist = 48;
  for (const el of slots) {
    const candidate = el.dataset.slot as GearSlot | undefined;
    if (!candidate || !isGearCompatibleWithLoadoutSlot(definition, candidate, loadout, inventoryList)) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(pointer.x - cx, pointer.y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = { slot: candidate, rect: r };
    }
  }
  return best;
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

  const inventoryList = Array.from(inventoryById.values());
  const directHit = findSlotUnderPointer(pointer, definition, loadout, inventoryList, equipmentSnapInsetRatio);
  if (directHit) return { kind: "equipment", slot: directHit.slot, rect: directHit.rect };

  const nearest = findNearestCompatibleSlot(pointer, definition, loadout, inventoryList);
  if (nearest) return { kind: "equipment", slot: nearest.slot, rect: nearest.rect };
  return null;
}

export function getInventoryDragDestination({
  board,
  instance,
  boardObstacles,
}: {
  board: HTMLElement;
  instance: GearInstance;
  boardObstacles: Array<PackedInventoryItem<{ instanceId: string }>>;
}): { kind: "inventory"; placement: InventoryPlacement; rect: DragRect } | null {
  const metrics = readInventoryBoardMetrics(board);
  const footprint = footprintForInstance(instance);
  if (!metrics || !footprint) return null;
  const placement = findFirstInventoryPlacement(boardObstacles, instance.instanceId, footprint, INVENTORY_COLS);
  return {
    kind: "inventory",
    placement,
    rect: inventoryCellDragRect({ board, placement, footprint, metrics }),
  };
}

function shouldDisplaceOtherSlot(slot: GearSlot, def: GearDefinition, otherDef: GearDefinition): boolean {
  if (slot === "main-hand") {
    if (def.requiresTwoHands) return true;
    if (otherDef.requiresTwoHands) return true;
    if (otherDef.quiver && !def.rangedWeapon) return true;
    if (!otherDef.quiver && def.rangedWeapon) return true;
    return false;
  }
  if (slot === "off-hand" && otherDef.requiresTwoHands) return true;
  return false;
}

function getOppositeSlot(slot: GearSlot): GearSlot | null {
  if (slot === "main-hand") return "off-hand";
  if (slot === "off-hand") return "main-hand";
  return null;
}

function findOtherSlotAnimation(
  slot: GearSlot,
  loadout: GearLoadout,
  instance: GearInstance,
  displaced: GearInstance | null | undefined,
  inventoryById: Map<string, GearInstance>,
  slotRect: DragRect,
  vacatedPlacement: InventoryPlacement,
): { instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement } | null {
  const otherSlot = getOppositeSlot(slot);
  if (!otherSlot) return null;
  const otherId = loadout[otherSlot];
  if (!otherId) return null;
  if (otherId === instance.instanceId) return null;
  if (otherId === displaced?.instanceId) return null;
  const otherInstance = inventoryById.get(otherId);
  if (!otherInstance) return null;
  const otherDef = gearDefinitions[otherInstance.definitionId];
  const def = gearDefinitions[instance.definitionId];
  if (!otherDef || !def) return null;
  if (!shouldDisplaceOtherSlot(slot, def, otherDef)) return null;
  const otherEl = document.querySelector<HTMLElement>(
    `[data-testid='armory-equipment-slot'][data-slot='${otherSlot}']`,
  );
  const source = otherEl ? otherEl.getBoundingClientRect() : slotRect;
  return { instance: otherInstance, source, vacatedPlacement };
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
}): Array<{ instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement }> {
  const { displaced } = resolveEquipSwap({ loadout, slot, instance, vacatedPlacement, inventoryById, packedItems });
  const toAnimate: Array<{ instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement }> = [];
  if (displaced) toAnimate.push({ instance: displaced, source: slotRect, vacatedPlacement });
  const otherAnim = findOtherSlotAnimation(
    slot,
    loadout,
    instance,
    displaced,
    inventoryById,
    slotRect,
    vacatedPlacement,
  );
  if (otherAnim) toAnimate.push(otherAnim);
  return toAnimate;
}

export interface SecondaryDragVisual {
  instance: GearInstance;
  source: DragRect;
  rect: DragRect;
  origin: { kind: "inventory"; placement: InventoryPlacement };
  destination: DragDestination;
  flyover: boolean;
}

export function buildSecondaryDragVisuals({
  board,
  displacedItems,
}: {
  board: HTMLElement;
  displacedItems: Array<{ instance: GearInstance; source: DragRect; vacatedPlacement: InventoryPlacement }>;
}): SecondaryDragVisual[] {
  const metrics = readInventoryBoardMetrics(board);
  if (!metrics) return [];

  const visuals: SecondaryDragVisual[] = [];
  for (const { instance: displaced, source, vacatedPlacement } of displacedItems) {
    const footprint = footprintForInstance(displaced);
    if (!footprint) continue;
    const destinationRect = inventoryCellDragRect({ board, placement: vacatedPlacement, footprint, metrics });
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
