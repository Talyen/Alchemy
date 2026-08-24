import { ARMORY_SLOTS, type ArmorySlot } from "@/lib/gear";

export const SLOT_LABELS: Record<ArmorySlot, string> = {
  "main-hand": "Weapons",
  "off-hand": "Weapons",
  body: "Armor",
  "left-accessory": "Accessories",
  trinket: "Trinkets",
  "right-accessory": "Accessories",
};

export const SLOT_ARIA_LABELS: Record<ArmorySlot, string> = {
  "main-hand": "Main-hand equipment slot",
  "off-hand": "Off-hand equipment slot",
  body: "Armor equipment slot",
  "left-accessory": "Left accessory equipment slot",
  trinket: "Trinket equipment slot",
  "right-accessory": "Right accessory equipment slot",
};

export const EQUIP_SLOTS: ArmorySlot[] = [...ARMORY_SLOTS];
