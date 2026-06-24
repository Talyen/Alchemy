// Leaf module for core gear types — no imports from gear siblings.
// Kept separate so base-items.ts, types.ts, and definitions.ts can reference
// the same types without circular dependencies.

export const GEAR_SLOTS = [
  "body",
  "helm",
  "boots",
  "gloves",
  "belt",
  "main-hand",
  "off-hand",
  "left-ring",
  "right-ring",
  "amulet",
] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];
export type GearRarity = "basic" | "astral";

export const GEAR_RARITIES = ["basic", "astral"] as const satisfies readonly GearRarity[];
