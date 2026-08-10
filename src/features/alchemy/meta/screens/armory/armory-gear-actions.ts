// Armory gear drag actions: destination resolution, occupant/swap lookups,
// gear + currency commit, and double-click flyover. Consolidates the pieces
// that used to live in armory-drag-helpers.ts, armory-gear-commit.ts, and
// armory-gear-double-click.ts so slot/occupant logic lives in one place.

import { playUISound } from "@/lib/audio";
import {
  canEquipInOffHand,
  findFirstInventoryPlacement,
  footprintForInstance,
  gearDefinitions,
  INVENTORY_COLS,
  isGearCompatibleWithLoadoutSlot,
  isTwoHanded,
  type CraftingCurrencyId,
  type GearDefinition,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
  type InventoryPlacement,
  type PackedCurrencyItem,
  type PackedInventory,
  type PackedInventoryItem,
} from "@/lib/gear";
import { overlaps } from "@/lib/gear/grid-packing";
import type { CharacterId } from "@/lib/game-data";
import type { CurrencyDragOrigin, DragDestination, DragPoint, DragRect, GearDragOrigin } from "./armory-drag-types";
import { readInventoryBoardMetrics, resolveInventoryCellRect } from "./board-drag-math";
import { resolveEquipSwap } from "./resolve-equip-swap";

// ── Environment assembled by the drag hook at commit time ──

export interface ArmoryDragEnv {
  characterId: CharacterId;
  inventoryById: Map<string, GearInstance>;
  packedInventory: PackedInventory;
  packedCurrencies: PackedCurrencyItem[];
  inventoryBoard: HTMLDivElement | null;
  onEquip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement },
  ) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onMoveItem: (instanceId: string, col: number, row: number) => void;
  onMoveCurrency: (currencyId: CraftingCurrencyId, col: number, row: number) => void;
  maybeLaunchSwapAnimations: (
    instance: GearInstance,
    slot: GearSlot,
    slotRect: DragRect,
    vacatedPlacement: InventoryPlacement,
  ) => void;
}

// ── Slot resolution under the pointer ──

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

function getInventoryDragDestination({
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
    rect: resolveInventoryCellRect(board, placement, footprint, metrics),
  };
}

// ── Swap / displacement animations for two-hand and main-hand swaps ──

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
    const destinationRect = resolveInventoryCellRect(board, vacatedPlacement, footprint, metrics);
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

// ── Commit logic (drag + double-click share these) ──

function computeOccupantRect(
  occupantInstance: GearInstance,
  destRect: DragRect,
  board: HTMLDivElement | null,
): DragRect {
  const sourceRect = destRect;
  if (!board) return sourceRect;
  const metrics = readInventoryBoardMetrics(board);
  if (!metrics) return sourceRect;
  const fprint = footprintForInstance(occupantInstance);
  if (!fprint) return sourceRect;
  const { cellSize, gap } = metrics;
  const occupantWidth = cellSize * fprint.w + gap * (fprint.w - 1);
  const occupantHeight = cellSize * fprint.h + gap * (fprint.h - 1);
  const destCenterX = destRect.left + destRect.width / 2;
  const destCenterY = destRect.top + destRect.height / 2;
  return {
    left: destCenterX - occupantWidth / 2,
    top: destCenterY - occupantHeight / 2,
    width: occupantWidth,
    height: occupantHeight,
  };
}

function findInventoryOccupant(
  id: string,
  destination: { placement: { col: number; row: number } },
  instance: GearInstance,
  packedInventory: PackedInventory,
) {
  const footprint = footprintForInstance(instance);
  if (!footprint) return undefined;
  return packedInventory.items.find(
    (item) =>
      item.item.instanceId !== id &&
      overlaps(
        { col: destination.placement.col, row: destination.placement.row, w: footprint.w, h: footprint.h },
        { col: item.col, row: item.row, w: item.w, h: item.h },
      ),
  );
}

function findCurrencyOccupant(
  destination: { placement: { col: number; row: number } },
  instance: GearInstance,
  packedCurrencies: PackedCurrencyItem[],
) {
  const footprint = footprintForInstance(instance);
  if (!footprint) return undefined;
  return packedCurrencies.find((currency) =>
    overlaps(
      { col: destination.placement.col, row: destination.placement.row, w: footprint.w, h: footprint.h },
      { col: currency.col, row: currency.row, w: currency.w, h: currency.h },
    ),
  );
}

export type HeldDragResult =
  | { kind: "gear"; item: GearInstance; origin: GearDragOrigin; source: DragRect }
  | { kind: "currency"; item: { currencyId: CraftingCurrencyId }; origin: CurrencyDragOrigin; source: DragRect };

export type CommitResult = { heldItem: HeldDragResult } | undefined;

function commitGearInventoryDestination({
  id,
  origin,
  destination,
  instance,
  env,
}: {
  id: string;
  origin: GearDragOrigin;
  destination: { kind: "inventory"; placement: { col: number; row: number }; rect: DragRect };
  instance: GearInstance;
  env: ArmoryDragEnv;
}): CommitResult {
  if (origin.kind === "equipment") {
    env.onUnequip(env.characterId, origin.slot);
    env.onMoveItem(id, destination.placement.col, destination.placement.row);
    return undefined;
  }
  const unchanged =
    origin.placement.col === destination.placement.col && origin.placement.row === destination.placement.row;
  if (unchanged) return undefined;

  const occupant = findInventoryOccupant(id, destination, instance, env.packedInventory);
  const occupantCurrency = findCurrencyOccupant(destination, instance, env.packedCurrencies);
  env.onMoveItem(id, destination.placement.col, destination.placement.row);

  if (occupant) {
    const occupantInstance = env.inventoryById.get(occupant.item.instanceId);
    if (occupantInstance) {
      return {
        heldItem: {
          kind: "gear",
          item: occupantInstance,
          origin: { kind: "inventory", placement: { col: occupant.col, row: occupant.row } },
          source: computeOccupantRect(occupantInstance, destination.rect, env.inventoryBoard),
        },
      };
    }
  } else if (occupantCurrency) {
    return {
      heldItem: {
        kind: "currency",
        item: { currencyId: occupantCurrency.currencyId },
        origin: { kind: "inventory", placement: { col: occupantCurrency.col, row: occupantCurrency.row } },
        source: destination.rect,
      },
    };
  }
  return undefined;
}

export function handleGearCommit({
  id,
  origin,
  destination,
  instance,
  env,
}: {
  id: string;
  origin: GearDragOrigin;
  destination: DragDestination;
  instance: GearInstance;
  env: ArmoryDragEnv;
}): CommitResult {
  if (destination.kind === "equipment") {
    const slot = destination.slot as GearSlot;
    const vacatedPlacement = origin.kind === "inventory" ? origin.placement : undefined;
    if (vacatedPlacement) {
      env.maybeLaunchSwapAnimations(instance, slot, destination.rect, vacatedPlacement);
    }
    env.onEquip(env.characterId, slot, instance, vacatedPlacement ? { vacatedPlacement } : undefined);
  } else if (destination.kind === "inventory") {
    return commitGearInventoryDestination({ id, origin, destination, instance, env });
  }
  return undefined;
}

export function handleCurrencyCommit({
  id,
  origin,
  destination,
  env,
}: {
  id: CraftingCurrencyId;
  origin: CurrencyDragOrigin;
  destination: DragDestination;
  env: ArmoryDragEnv;
}): CommitResult {
  if (destination.kind !== "inventory") return undefined;
  if (origin.placement.col === destination.placement.col && origin.placement.row === destination.placement.row) {
    return undefined;
  }
  const { col, row } = destination.placement;
  const occupant = env.packedInventory.items.find((item) =>
    overlaps({ col, row, w: 1, h: 1 }, { col: item.col, row: item.row, w: item.w, h: item.h }),
  );
  const occupantInstance = occupant ? env.inventoryById.get(occupant.item.instanceId) : undefined;
  const occupantCurrency = env.packedCurrencies.find(
    (currency) => currency.currencyId !== id && currency.col === col && currency.row === row,
  );
  env.onMoveCurrency(id, col, row);
  if (occupant && occupantInstance) {
    return {
      heldItem: {
        kind: "gear",
        item: occupantInstance,
        origin: { kind: "inventory", placement: { col: occupant.col, row: occupant.row } },
        source: destination.rect,
      },
    };
  }
  if (occupantCurrency) {
    return {
      heldItem: {
        kind: "currency",
        item: { currencyId: occupantCurrency.currencyId },
        origin: { kind: "inventory", placement: { col: occupantCurrency.col, row: occupantCurrency.row } },
        source: destination.rect,
      },
    };
  }
  return undefined;
}

// ── Double-click flyover ──

function findEquipSlotForDoubleClickedGear(loadout: GearLoadout, definition: GearDefinition): GearSlot | null {
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

export type FlyoverTo = (
  item: { instance: GearInstance; origin: GearDragOrigin },
  destination: DragDestination,
  commit: () => void,
  source?: DragRect,
) => void;

export function handleGearDoubleClickAction({
  editable,
  instance,
  origin,
  source,
  env,
  loadout,
  boardObstacles,
  flyoverTo,
}: {
  editable: boolean;
  instance: GearInstance;
  origin: GearDragOrigin;
  source: DragRect;
  env: ArmoryDragEnv;
  loadout: GearLoadout;
  boardObstacles: Array<PackedInventoryItem<{ instanceId: string }>>;
  flyoverTo: FlyoverTo;
}) {
  if (!editable) return;
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return;

  if (origin.kind === "inventory") {
    const slot = findEquipSlotForDoubleClickedGear(loadout, definition);
    if (!slot) {
      playUISound("error");
      return;
    }
    const slotElement = document.querySelector<HTMLElement>(
      `[data-testid='armory-equipment-slot'][data-slot='${slot}']`,
    );
    if (!slotElement) return;
    const slotRect = slotElement.getBoundingClientRect();
    flyoverTo(
      { instance, origin },
      { kind: "equipment", slot, rect: slotRect },
      () => {
        env.maybeLaunchSwapAnimations(instance, slot, slotRect, origin.placement);
        env.onEquip(env.characterId, slot, instance, { vacatedPlacement: origin.placement });
      },
      source,
    );
    return;
  }

  if (!env.inventoryBoard) return;
  const destination = getInventoryDragDestination({ board: env.inventoryBoard, instance, boardObstacles });
  if (!destination) return;
  flyoverTo(
    { instance, origin },
    destination,
    () => {
      env.onMoveItem(instance.instanceId, destination.placement.col, destination.placement.row);
      env.onUnequip(env.characterId, origin.slot);
    },
    source,
  );
}
