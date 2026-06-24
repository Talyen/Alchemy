// Leaf module for encounter trait ID types — no imports from siblings.
// Kept separate so content-systems/types.ts and encounter-traits.ts can
// both reference the same type definitions without a circular dependency.

export const COMBAT_ENCOUNTER_TRAIT_IDS = [
  "tempered",
  "plated",
  "reinforced",
  "braced",
  "septic",
  "caustic",
  "flesheater",
  "combustible",
  "chilling",
  "thorns",
  "zealot",
  "insatiable",
  "jealous",
  "concussive",
  "rooted",
  "overgrowth",
  "holy-retribution",
  "divine-aegis",
] as const;

export const REWARD_ENCOUNTER_TRAIT_IDS = ["generous", "alchemist", "scavenger", "companion"] as const;

export type EncounterCombatTraitId = (typeof COMBAT_ENCOUNTER_TRAIT_IDS)[number];
export type EncounterRewardTraitId = (typeof REWARD_ENCOUNTER_TRAIT_IDS)[number];
export type EncounterTraitId = EncounterCombatTraitId | EncounterRewardTraitId;
