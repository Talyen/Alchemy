import type { BattleCardEffect } from "@/lib/game-data";

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

/** Select before defenses or reactions change the resources used by the condition. */
export function resolveConditionalCardDamage(
  effect: DamageEffect,
  resources: { actorBlock: number; targetBlock: number; targetFrozen: boolean },
): { effect: DamageEffect; blockSpent: number } {
  const {
    blockCost,
    blockDamageBonus,
    damageTypeIfTargetHasBlock,
    damageTypeIfTargetFrozen,
    amountIfTargetFrozen,
    ...resolved
  } = effect;
  let blockSpent = 0;
  if (blockCost !== undefined && resources.actorBlock >= blockCost) {
    blockSpent = blockCost;
    resolved.amount += blockDamageBonus ?? 0;
  }
  if (damageTypeIfTargetHasBlock && resources.targetBlock > 0) resolved.damageType = damageTypeIfTargetHasBlock;
  if (damageTypeIfTargetFrozen && resources.targetFrozen) {
    resolved.damageType = damageTypeIfTargetFrozen;
    resolved.amount = amountIfTargetFrozen ?? resolved.amount;
  }
  return { effect: resolved, blockSpent };
}
