import { effectChildren, type BattleCard, type BattleCardEffect } from "@/lib/game-data";

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
    effect = effectChildren(effect)[index];
  }
  return effect;
}
