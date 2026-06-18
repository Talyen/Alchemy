import type { CSSProperties } from "react";
import { GEAR_FOOTPRINT, type GearSlot } from "@/lib/gear";

export const SLOT_LABELS: Record<GearSlot, string> = {
  body: "Body",
  helm: "Helm",
  boots: "Boots",
  gloves: "Gloves",
  belt: "Belt",
  "main-hand": "Main Hand",
  "off-hand": "Off-Hand",
  "left-ring": "Left Ring",
  "right-ring": "Right Ring",
  amulet: "Amulet",
};

export const EQUIP_SLOT_PLACEMENT: Record<GearSlot, { x: number; y: number }> = {
  helm: { x: 2, y: 0 },
  amulet: { x: 4, y: 0 },
  "left-ring": { x: 1, y: 1 },
  "right-ring": { x: 4, y: 1 },
  "main-hand": { x: 0, y: 2 },
  body: { x: 2, y: 2 },
  "off-hand": { x: 4, y: 2 },
  gloves: { x: 0, y: 5 },
  belt: { x: 2, y: 5 },
  boots: { x: 4, y: 5 },
};

export const EQUIP_SLOTS = Object.keys(EQUIP_SLOT_PLACEMENT) as GearSlot[];

export function equipmentSlotStyle(slot: GearSlot): CSSProperties {
  const { x, y } = EQUIP_SLOT_PLACEMENT[slot];
  const { w, h } = GEAR_FOOTPRINT[slot];
  return {
    left: `calc(${x} * (var(--armory-cell-size) + var(--armory-board-gap)))`,
    top: `calc(${y} * (var(--armory-cell-size) + var(--armory-board-gap)))`,
    width: `calc(${w} * var(--armory-cell-size) + ${w - 1} * var(--armory-board-gap))`,
    height: `calc(${h} * var(--armory-cell-size) + ${h - 1} * var(--armory-board-gap))`,
  };
}

export function packedItemStyle({ col, row, w, h }: { col: number; row: number; w: number; h: number }): CSSProperties {
  return {
    left: `calc(${col - 1} * (var(--armory-cell-size) + var(--armory-board-gap)))`,
    top: `calc(${row - 1} * (var(--armory-cell-size) + var(--armory-board-gap)))`,
    width: `calc(${w} * var(--armory-cell-size) + ${w - 1} * var(--armory-board-gap))`,
    height: `calc(${h} * var(--armory-cell-size) + ${h - 1} * var(--armory-board-gap))`,
  };
}
