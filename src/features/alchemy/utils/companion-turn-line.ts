// Re-exports companion turn-line formatting used by battle UI tooltips.
import { formatCompanionTurnLineBase, type BattleCardEffect } from "@/lib/game-data";

export type CompanionTurnLineContext = {
  bondLevel?: number;
  damageBonus?: number;
};

export function formatCompanionTurnStartLine(
  turnEffect: BattleCardEffect,
  context: CompanionTurnLineContext = {},
): string | null {
  if (turnEffect.kind === "damage") {
    const bondLevel = context.bondLevel ?? 0;
    const globalBonus = context.damageBonus ?? 0;
    return formatCompanionTurnLineBase(turnEffect, turnEffect.amount + bondLevel + globalBonus);
  }
  return formatCompanionTurnLineBase(turnEffect);
}
