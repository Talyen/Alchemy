import type { GearSlot } from "@/lib/gear";

export const SLOT_LABELS: Record<GearSlot, string> = {
  "main-hand": "Weapon 1",
  "off-hand": "Weapon 2",
  body: "Armor",
  "left-ring": "Ring 1",
  "right-ring": "Ring 2",
  amulet: "Amulet",
};

export const EQUIP_SLOTS: GearSlot[] = ["main-hand", "off-hand", "body", "left-ring", "right-ring", "amulet"];
