import type { MysteryEffect } from "./types";

const EFFECT_DISPLAY_RANK = {
  gainXP: 0,
  gainGold: 2,
  loseGold: 2,
  gainMaterial: 3,
  addCard: 1,
  chooseCard: 1,
  healHealth: 1,
  damageHealth: 1,
  removeCard: 1,
  gainTrinket: 1,
  gainRandomTrinket: 1,
  gainRandomGear: 1,
  gainGeneratedGear: 1,
} satisfies Record<MysteryEffect["kind"], number>;

export function getMysteryEffectRank(effect: MysteryEffect): number {
  return EFFECT_DISPLAY_RANK[effect.kind];
}

export function sortMysteryEffectsByDisplayOrder(effects: readonly MysteryEffect[]): MysteryEffect[] {
  return [...effects].sort((a, b) => getMysteryEffectRank(a) - getMysteryEffectRank(b));
}
