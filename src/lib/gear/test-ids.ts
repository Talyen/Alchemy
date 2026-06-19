export const ARMORY_EQUIPMENT_SLOT_TEST_ID = "armory-equipment-slot";
export const ARMORY_INVENTORY_ITEM_TEST_ID = "armory-inventory-item";
export const ARMORY_CRAFTING_CURRENCY_TEST_ID = "armory-crafting-currency";
export const ARMORY_GEAR_DRAG_VISUAL_TEST_ID = "armory-gear-drag-visual";
export const ARMORY_CRAFTING_CURSOR_TEST_ID = "armory-crafting-cursor";
export const ARMORY_SALVAGE_TOGGLE_TEST_ID = "armory-salvage-toggle";
export const ARMORY_CHARACTER_SELECTOR_TEST_ID = "armory-character-selector";
export const ARMORY_INVENTORY_BOARD_TEST_ID = "armory-inventory-board";
export const ARMORY_SCREEN_TEST_ID = "armory-screen";
export const ARMORY_CHARACTER_ART_CONTAINER_TEST_ID = "armory-character-art-container";
export const ARMORY_SLOT_BACKGROUND_TEST_ID = "armory-slot-background";
export const ARMORY_TRANSFER_MENU_TEST_ID = "armory-transfer-menu";

export const ARMORY_GRID_METRIC_CELL = "cell";
export const ARMORY_GRID_METRIC_STRIDE = "stride";

export function equipmentSlotTestId(slot: string): string {
  return `[data-testid="${ARMORY_EQUIPMENT_SLOT_TEST_ID}"][data-slot="${slot}"]`;
}

export function inventoryCellTestId(col: number, row: number): string {
  return `[data-armory-inventory-cell="${col}-${row}"]`;
}
