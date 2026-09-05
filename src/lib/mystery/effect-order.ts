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
    case "addCard":
    case "chooseCard":
    case "healHealth":
    case "damageHealth":
    case "removeCard":
    case "gainTrinket":
    case "gainRandomTrinket":
    case "gainRandomGear":
    case "gainGeneratedGear":
      return 1;
  }
}

export function sortMysteryEffectsByDisplayOrder(effects: readonly MysteryEffect[]): MysteryEffect[] {
  return [...effects].sort((a, b) => getMysteryEffectRank(a) - getMysteryEffectRank(b));
}
