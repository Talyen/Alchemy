// Player-facing text for companion turn-start effects (battle tooltip + card descriptions).
import { capitalizeWord } from "@/lib/utils";
import type { BattleCardEffect } from "@/lib/game-data";

export type CompanionTurnLineContext = {
  bondLevel?: number;
  damageBonus?: number;
};

function displayDamageType(type: string): string {
  return capitalizeWord(type);
}

export function formatCompanionTurnStartLine(
  turnEffect: BattleCardEffect,
  context: CompanionTurnLineContext = {},
): string | null {
  const bondLevel = context.bondLevel ?? 0;
  const globalBonus = context.damageBonus ?? 0;

  switch (turnEffect.kind) {
    case "damage":
      return `Deals ${turnEffect.amount + bondLevel + globalBonus} ${displayDamageType(turnEffect.damageType)} damage each turn`;
    case "heal":
      return `Restores ${turnEffect.amount} Health each turn`;
    case "restore-mana":
      return `Restores ${turnEffect.amount} Mana each turn`;
    case "remove-harmful-status":
      return `Cleanses ${turnEffect.amount} harmful status${turnEffect.amount === 1 ? "" : "es"} each turn`;
    case "gain-gold":
      return `Steals ${turnEffect.amount} Gold each turn`;
    case "player-status":
      if (turnEffect.status === "block") return `Gain ${turnEffect.amount} Block each turn`;
      return null;
    case "draw-cards":
      return `Draws ${turnEffect.amount} Card${turnEffect.amount === 1 ? "" : "s"} each turn`;
    default:
      return null;
  }
}
