export const GEAR_AFFIX_IDS = [
  "flat-physical-1",
  "flat-stun-1",
  "flat-holy-1",
  "flat-burn-1",
  "flat-poison-1",
  "flat-bleed-1",
  "flat-freeze-1",
  "flat-nature-1",
] as const;

export type GearAffixId = (typeof GEAR_AFFIX_IDS)[number];
