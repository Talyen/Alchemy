import { capitalizeWord } from "@/lib/utils";
import type { BattleCardEffect } from "../types";

export function conditionalDamageDescription(effect: BattleCardEffect): string | undefined {
  if (effect.kind !== "damage") return undefined;
  const base = `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
  if (effect.blockCost !== undefined) {
    return `${base}; Spend ${effect.blockCost} Block for +${effect.blockDamageBonus} damage`;
  }
  if (effect.damageTypeIfTargetHasBlock) {
    return `${base}, or ${effect.amount} ${capitalizeWord(effect.damageTypeIfTargetHasBlock)} against enemies with Block`;
  }
  if (effect.damageTypeIfTargetFrozen) {
    return `${base}; Against Frozen enemies, deal ${effect.amountIfTargetFrozen} ${capitalizeWord(effect.damageTypeIfTargetFrozen)} instead`;
  }
  return undefined;
}
