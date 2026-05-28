// Companion summon card turn-line text derived from companionLibrary turn-start effects.
import { capitalizeWord } from "@/lib/utils";
import type { BattleCardEffect } from "../types";

/** Base companion turn-start line; optional amountOverride applies to damage (and block) only. */
export function formatCompanionTurnLineBase(effect: BattleCardEffect, amountOverride?: number): string | null {
  switch (effect.kind) {
    case "damage": {
      const amount = amountOverride ?? effect.amount;
      return `Deals ${amount} ${capitalizeWord(effect.damageType)} damage each turn`;
    }
    case "heal":
      return `Restores ${effect.amount} Health each turn`;
    case "restore-mana":
      return `Restores ${effect.amount} Mana each turn`;
    case "remove-harmful-status":
      return `Cleanses ${effect.amount} harmful status${effect.amount === 1 ? "" : "es"} each turn`;
    case "gain-gold":
      return `Steals ${effect.amount} Gold each turn`;
    case "player-status":
      if (effect.status === "block") return `Gain ${effect.amount} Block each turn`;
      return null;
    case "draw-cards":
      return `Draws ${effect.amount} Card${effect.amount === 1 ? "" : "s"} each turn`;
    default:
      return null;
  }
}

export function expectedCompanionTurnLine(effect: BattleCardEffect): string {
  const line = formatCompanionTurnLineBase(effect);
  if (!line) {
    throw new Error(`Unhandled companion turn-start effect: ${(effect as { kind: string }).kind}`);
  }
  return line;
}
