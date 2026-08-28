import type { MysteryEffect } from "./types";

// Display order: XP → gold → materials → portrait reward (card/trinket/gear/etc).
// Used by tooltips, reward summary grouping, and pool authoring tests.
export function getMysteryEffectRank(effect: MysteryEffect): number {
  switch (effect.kind) {
    case "gainXP":
      return 0;
    case "gainGold":
    case "loseGold":
      return 1;
    case "gainMaterial":
      return 2;
    default:
      return 3;
  }
}

export function sortMysteryEffectsByDisplayOrder(effects: readonly MysteryEffect[]): MysteryEffect[] {
  return [...effects].sort((a, b) => getMysteryEffectRank(a) - getMysteryEffectRank(b));
}
