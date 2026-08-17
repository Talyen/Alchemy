import type { GearSlot } from "@/lib/gear";

export const SLOT_LABELS: Record<GearSlot, string> = {
  "main-hand": "Weapons",
  "off-hand": "Weapons",
  body: "Armor",
  "left-ring": "Rings",
  "right-ring": "Rings",
  amulet: "Amulets",
};

export const SLOT_ARIA_LABELS: Record<GearSlot, string> = {
  "main-hand": "Main-hand equipment slot",
  "off-hand": "Off-hand equipment slot",
  body: "Armor equipment slot",
  "left-ring": "Left-ring equipment slot",
  "right-ring": "Right-ring equipment slot",
  amulet: "Amulet equipment slot",
};

export const EQUIP_SLOTS: GearSlot[] = ["main-hand", "off-hand", "body", "left-ring", "right-ring", "amulet"];
