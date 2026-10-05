import { getCardEffect, type BattleCard, type BattleCardEffect, type CardEffectAddress } from "@/lib/game-data";

export type NumericEffectAddress = CardEffectAddress;

export function effectAddressKey(address: NumericEffectAddress): string {
  return [address.effectIndex, ...(address.effectPath ?? [])].join("/");
}

export function getCorruptionTargetEffect(
  card: BattleCard,
  target: NumericEffectAddress,
): BattleCardEffect | undefined {
  return getCardEffect(card.effects, target);
}
