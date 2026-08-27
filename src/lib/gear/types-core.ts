// Leaf module for core gear types — no imports from gear siblings.
// Kept separate so base-items.ts, types.ts, and definitions.ts can reference
// the same types without circular dependencies.

export const GEAR_SLOTS = ["main-hand", "off-hand", "body", "left-accessory", "right-accessory"] as const;
export const ARMORY_SLOTS = ["main-hand", "off-hand", "body", "left-accessory", "trinket", "right-accessory"] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];
export type ArmorySlot = (typeof ARMORY_SLOTS)[number];
export type GearRarity = "basic" | "astral" | "unique";

export const GEAR_RARITIES = ["basic", "astral", "unique"] as const satisfies readonly GearRarity[];

/** Gear reward rarity tiers (permanent Trinkets use a separate reward-flow gate). */
export type ItemDropTier = GearRarity;
