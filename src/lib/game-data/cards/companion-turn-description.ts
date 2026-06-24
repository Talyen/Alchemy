// Companion summon card turn-line text derived from companionLibrary turn-start effects.
import { capitalizeWord } from "@/lib/utils";
import type { BattleCardEffect } from "../types";

type CompanionTurnLineFormatter<K extends BattleCardEffect["kind"]> = (
  effect: Extract<BattleCardEffect, { kind: K }>,
  amountOverride: number | undefined,
) => string | null;

const COMPANION_TURN_LINE_FORMATTERS: {
  [K in BattleCardEffect["kind"]]: CompanionTurnLineFormatter<K>;
} = {
  damage: (effect, amountOverride) => {
    const amount = amountOverride ?? effect.amount;
    return `Deals ${amount} ${capitalizeWord(effect.damageType)} damage each turn`;
  },
  heal: (effect) => `Restores ${effect.amount} Health each turn`,
  "restore-mana": (effect) => `Restores ${effect.amount} Mana each turn`,
  "remove-harmful-status": (effect) => {
    const pluralSuffix = effect.amount === 1 ? "" : "es";
    return `Cleanses ${effect.amount} harmful status${pluralSuffix} each turn`;
  },
  "gain-gold": (effect) => `Steals ${effect.amount} Gold each turn`,
  "player-status": (effect) => (effect.status === "block" ? `Gains ${effect.amount} Block each turn` : null),
  "draw-cards": (effect) => {
    const pluralSuffix = effect.amount === 1 ? "" : "s";
    return `Draws ${effect.amount} Card${pluralSuffix} each turn`;
  },
  "enemy-status": () => null,
  "lose-mana": () => null,
  "lose-max-mana": () => null,
  "gain-max-mana": () => null,
  "summon-companion": () => null,
  "buff-companion": () => null,
  "lose-health": () => null,
  "remove-enemy-armor": () => null,
  "multiply-enemy-status": () => null,
  "remove-player-status": () => null,
  "self-damage": () => null,
  "cleanse-player-status-to-damage": () => null,
  "random-damage": () => null,
  wish: () => null,
  chance: () => null,
};

function companionTurnLine(effect: BattleCardEffect, amountOverride?: number): string | null {
  return COMPANION_TURN_LINE_FORMATTERS[effect.kind](effect as never, amountOverride);
}

/** Base companion turn-start line; optional amountOverride applies to damage (and block) only. */
export function formatCompanionTurnLineBase(effect: BattleCardEffect, amountOverride?: number): string | null {
  return companionTurnLine(effect, amountOverride);
}

export function expectedCompanionTurnLine(effect: BattleCardEffect): string {
  const line = companionTurnLine(effect);
  if (!line) {
    throw new Error(`Unhandled companion turn-start effect: ${(effect as BattleCardEffect).kind}`);
  }
  return line;
}
