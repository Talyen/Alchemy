export const GEAR_SLOTS = ["main-hand", "off-hand", "body", "left-accessory", "right-accessory"] as const;
export const ARMORY_SLOTS = ["main-hand", "off-hand", "body", "left-accessory", "trinket", "right-accessory"] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];
export type ArmorySlot = (typeof ARMORY_SLOTS)[number];
export type GearRarity = "basic" | "astral" | "unique";

export const GEAR_RARITIES = ["basic", "astral", "unique"] as const satisfies readonly GearRarity[];
