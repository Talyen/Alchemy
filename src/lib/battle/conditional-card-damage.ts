import type { BattleCardEffect } from "@/lib/game-data";

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

/** Resolve the Frozen alternative before hits or reactions change control. */
export function resolveConditionalCardDamage(effect: DamageEffect, targetFrozen: boolean): DamageEffect {
  const { damageTypeIfTargetFrozen, amountIfTargetFrozen, ...resolved } = effect;
  if (damageTypeIfTargetFrozen && targetFrozen) {
    resolved.damageType = damageTypeIfTargetFrozen;
    resolved.amount = amountIfTargetFrozen ?? resolved.amount;
  }
  return resolved;
}
