import type {
  CraftingCurrencyId,
  GearInstance,
  GearSlot,
  InventoryPlacement,
  PackedCurrencyItem,
  PackedInventory,
} from "@/lib/gear";
import { footprintForInstance } from "@/lib/gear";
import { overlaps } from "@/lib/gear/grid-packing";
import type { CharacterId } from "@/lib/game-data";
import type { DragDestination, DragRect } from "./drag-types";
import { readInventoryBoardMetrics } from "./read-inventory-board-metrics";
import type { GearDragOrigin } from "./armory-gear-drag-types";

export interface GearCommitEnv {
  characterId: CharacterId;
  inventoryById: Map<string, GearInstance>;
  packedInventoryRef: { current: PackedInventory };
  packedCurrenciesRef: { current: PackedCurrencyItem[] };
  inventoryBoardRef: { current: HTMLDivElement | null };
  onEquip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement },
  ) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onMoveItem: (instanceId: string, col: number, row: number) => void;
  onHoldCurrency:
    | ((
        currencyId: CraftingCurrencyId,
        origin: { kind: "inventory"; placement: InventoryPlacement },
        source: DragRect,
      ) => void)
    | undefined;
  maybeLaunchSwapAnimations: (
    instance: GearInstance,
    slot: GearSlot,
    slotRect: DragRect,
    vacatedPlacement: InventoryPlacement,
  ) => void;
}

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

function handleGearInventoryDestination({
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
  env: GearCommitEnv;
}) {
  if (origin.kind === "equipment") {
    env.onUnequip(env.characterId, origin.slot);
    env.onMoveItem(id, destination.placement.col, destination.placement.row);
    return undefined;
  }
  const unchanged =
    origin.placement.col === destination.placement.col && origin.placement.row === destination.placement.row;
  if (unchanged) return undefined;

  const occupant = findInventoryOccupant(id, destination, instance, env.packedInventoryRef.current);
  const occupantCurrency = findCurrencyOccupant(destination, instance, env.packedCurrenciesRef.current);
  env.onMoveItem(id, destination.placement.col, destination.placement.row);

  if (occupant) {
    const occupantInstance = env.inventoryById.get(occupant.item.instanceId);
    if (occupantInstance) {
      return {
        heldItem: {
          item: {
            instance: occupantInstance,
            origin: { kind: "inventory" as const, placement: { col: occupant.col, row: occupant.row } },
          },
          source: computeOccupantRect(occupantInstance, destination.rect, env.inventoryBoardRef.current),
        },
      };
    }
  } else if (occupantCurrency && env.onHoldCurrency) {
    env.onHoldCurrency(
      occupantCurrency.currencyId,
      { kind: "inventory", placement: { col: occupantCurrency.col, row: occupantCurrency.row } },
      destination.rect,
    );
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
  env: GearCommitEnv;
}) {
  if (destination.kind === "equipment") {
    const slot = destination.slot as GearSlot;
    const vacatedPlacement = origin.kind === "inventory" ? origin.placement : undefined;
    if (vacatedPlacement) {
      env.maybeLaunchSwapAnimations(instance, slot, destination.rect, vacatedPlacement);
    }
    env.onEquip(env.characterId, slot, instance, vacatedPlacement ? { vacatedPlacement } : undefined);
  } else if (destination.kind === "inventory") {
    return handleGearInventoryDestination({ id, origin, destination, instance, env });
  }
  return undefined;
}
