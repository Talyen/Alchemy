import type { GearSlot } from "./types";

export const INVENTORY_COLS = 7;
export const INVENTORY_VISIBLE_ROWS = 8;
export const INVENTORY_SNAP_RADIUS_CELLS = 0.28;
export const MAGNET_SWITCH_MARGIN_PX = 14;
export const MAGNET_RELEASE_HYSTERESIS_PX = 18;
export const MAGNET_RELEASE_EASE_MS = 140;
export const DOUBLE_CLICK_FLYOVER_MS = 280;
export const DRAG_POINTER_ACTIVATE_DISTANCE_PX = 4;
export const EQUIPMENT_SNAP_INSET_RATIO = 0.3;
export const GEAR_SWAP_MAX_SEARCH_ROWS = 40;
export const GEAR_REWARD_DISTINCT_ATTEMPT_MULTIPLIER = 30;

export const HAND_SLOTS: Partial<Record<GearSlot, GearSlot>> = {
  "main-hand": "off-hand",
  "off-hand": "main-hand",
};
