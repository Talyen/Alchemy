import type { MysteryEffect } from "./types";

export function getMysteryEffectRank(effect: MysteryEffect): number {
  switch (effect.kind) {
    case "gainXP":
      return 0;
    case "gainGold":
    case "loseGold":
      return 2;
    case "gainMaterial":
      return 3;
    default:
      return 1;
  }
}

export function sortMysteryEffectsByDisplayOrder(effects: readonly MysteryEffect[]): MysteryEffect[] {
  return [...effects].sort((a, b) => getMysteryEffectRank(a) - getMysteryEffectRank(b));
}
