import { playUISound } from "@/lib/audio";
import {
  gearDefinitions,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
  type InventoryPlacement,
} from "@/lib/gear";
import type { CharacterId } from "@/lib/game-data";
import type { DragDestination, DragRect } from "./drag-types";
import type { GearDragOrigin } from "./use-armory-gear-drag";
import { findEquipSlotForDoubleClickedGear, getInventoryDragDestination } from "./armory-drag-helpers";
import type { PackedInventoryItem } from "@/lib/gear";

type FlyoverTo = (
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
  characterId,
  loadout,
  boardObstacles,
  inventoryBoard,
  flyoverTo,
  onEquip,
  onUnequip,
  onMoveItem,
  maybeLaunchSwapAnimations,
}: {
  editable: boolean;
  instance: GearInstance;
  origin: GearDragOrigin;
  source: DragRect;
  characterId: CharacterId;
  loadout: GearLoadout;
  boardObstacles: Array<PackedInventoryItem<{ instanceId: string }>>;
  inventoryBoard: HTMLDivElement | null;
  flyoverTo: FlyoverTo;
  onEquip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement },
  ) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onMoveItem: (instanceId: string, col: number, row: number) => void;
  maybeLaunchSwapAnimations: (
    instance: GearInstance,
    slot: GearSlot,
    slotRect: DragRect,
    vacatedPlacement: InventoryPlacement,
  ) => void;
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
        maybeLaunchSwapAnimations(instance, slot, slotRect, origin.placement);
        onEquip(characterId, slot, instance, { vacatedPlacement: origin.placement });
      },
      source,
    );
    return;
  }

  if (!inventoryBoard) return;
  const destination = getInventoryDragDestination({ board: inventoryBoard, instance, boardObstacles });
  if (!destination) return;
  flyoverTo(
    { instance, origin },
    destination,
    () => {
      onMoveItem(instance.instanceId, destination.placement.col, destination.placement.row);
      onUnequip(characterId, origin.slot);
    },
    source,
  );
}
