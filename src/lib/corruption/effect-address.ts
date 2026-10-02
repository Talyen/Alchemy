import type { BattleCard, BattleCardEffect } from "@/lib/game-data";

export interface NumericEffectAddress {
  effectIndex: number;
  effectPath?: number[];
}

export function effectAddressKey(address: NumericEffectAddress): string {
  return [address.effectIndex, ...(address.effectPath ?? [])].join("/");
}

export function getCorruptionTargetEffect(
  card: BattleCard,
  target: NumericEffectAddress,
): BattleCardEffect | undefined {
  let effect = card.effects[target.effectIndex];
  for (const index of target.effectPath ?? []) {
    if (!effect) return undefined;
    if (effect.kind === "chance") {
      // Address order is success then failure; index directly without merging branches.
      effect =
        index < effect.successEffects.length
          ? effect.successEffects[index]
          : effect.failureEffects[index - effect.successEffects.length];
    } else if (effect.kind === "repeat-over-turns") {
      effect = effect.effects[index];
    } else {
      return undefined;
    }
  }
  return effect;
}
