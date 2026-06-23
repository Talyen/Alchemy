// Companion summon card turn-line text derived from companionLibrary turn-start effects.
import { capitalizeWord } from "@/lib/utils";
import type { BattleCardEffect } from "../types";

type TurnLineRenderer = (effect: BattleCardEffect, amountOverride?: number) => string | null;

const COMPANION_TURN_LINE_RENDERERS: Partial<Record<BattleCardEffect["kind"], TurnLineRenderer>> = {
  damage: (effect, amountOverride) => {
    const e = effect as Extract<BattleCardEffect, { kind: "damage" }>;
    const amount = amountOverride ?? e.amount;
    return `Deals ${amount} ${capitalizeWord(e.damageType)} damage each turn`;
  },
  heal: (effect) => `Restores ${(effect as Extract<BattleCardEffect, { kind: "heal" }>).amount} Health each turn`,
  "restore-mana": (effect) =>
    `Restores ${(effect as Extract<BattleCardEffect, { kind: "restore-mana" }>).amount} Mana each turn`,
  "remove-harmful-status": (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "remove-harmful-status" }>;
    return `Cleanses ${e.amount} harmful status${e.amount === 1 ? "" : "es"} each turn`;
  },
  "gain-gold": (effect) =>
    `Steals ${(effect as Extract<BattleCardEffect, { kind: "gain-gold" }>).amount} Gold each turn`,
  "player-status": (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "player-status" }>;
    if (e.status === "block") return `Gains ${e.amount} Block each turn`;
    return null;
  },
  "draw-cards": (effect) => {
    const e = effect as Extract<BattleCardEffect, { kind: "draw-cards" }>;
    return `Draws ${e.amount} Card${e.amount === 1 ? "" : "s"} each turn`;
  },
};

/** Base companion turn-start line; optional amountOverride applies to damage (and block) only. */
export function formatCompanionTurnLineBase(effect: BattleCardEffect, amountOverride?: number): string | null {
  const render = COMPANION_TURN_LINE_RENDERERS[effect.kind];
  return render?.(effect, amountOverride) ?? null;
}

export function expectedCompanionTurnLine(effect: BattleCardEffect): string {
  const line = formatCompanionTurnLineBase(effect);
  if (!line) {
    throw new Error(`Unhandled companion turn-start effect: ${(effect as { kind: string }).kind}`);
  }
  return line;
}
