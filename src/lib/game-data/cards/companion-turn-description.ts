import { capitalizeWord } from "@/lib/utils";
import { getCompanionBondEffects } from "../companions";
import type { CompanionDefinition, BattleCardEffect } from "../types";

function companionTurnLine(effect: BattleCardEffect, amountOverride?: number): string | null {
  switch (effect.kind) {
    case "damage": {
      const amount = amountOverride ?? effect.amount;
      return `Deals ${amount} ${capitalizeWord(effect.damageType)} damage each turn`;
    }
    case "heal":
      return `Restores ${effect.amount} Health each turn`;
    case "restore-mana":
      return effect.allowOverflow
        ? `Grants ${effect.amount} extra Mana each turn`
        : `Restores ${effect.amount} Mana each turn`;
    case "remove-harmful-status": {
      const pluralSuffix = effect.amount === 1 ? "" : "es";
      return `Cleanses ${effect.amount} harmful status${pluralSuffix} each turn`;
    }
    case "gain-gold":
      return `Steals ${effect.amount} Gold each turn`;
    case "player-status":
      return effect.status === "block" ? `Gains ${effect.amount} Block each turn` : null;
    case "draw-cards": {
      const pluralSuffix = effect.amount === 1 ? "" : "s";
      return `Draws ${effect.amount} Card${pluralSuffix} each turn`;
    }
    case "chance": {
      const success = effect.successEffects[0] ? companionTurnLine(effect.successEffects[0]) : null;
      const failure = effect.failureEffects[0] ? companionTurnLine(effect.failureEffects[0]) : null;
      if (!success || !failure) return null;
      return `${success.replace(/ each turn$/, "")} or ${failure.replace(/ each turn$/, "")} each turn`;
    }
    case "wish":
    case "enemy-status":
    case "lose-mana":
    case "lose-max-mana":
    case "gain-max-mana":
    case "summon-companion":
    case "remove-player-status":
    case "self-damage":
    case "buff-companion":
    case "lose-health":
    case "remove-enemy-armor":
    case "multiply-enemy-status":
    case "cleanse-player-status-to-damage":
    case "random-damage":
    case "repeat-over-turns":
    case "next-hit-crit":
    case "play-next-card-twice":
    case "next-hit-poison":
    case "next-archery-free":
      return null;
  }
}

export function formatCompanionTurnLineBase(effect: BattleCardEffect, amountOverride?: number): string | null {
  return companionTurnLine(effect, amountOverride);
}

export interface CompanionTurnLineContext {
  bondLevel?: number;
  damageBonus?: number;
}

export function formatCompanionTurnStartLine(
  turnEffect: BattleCardEffect,
  context: CompanionTurnLineContext = {},
): string | null {
  if (turnEffect.kind === "damage") {
    const bondLevel = context.bondLevel ?? 0;
    const globalBonus = context.damageBonus ?? 0;
    return formatCompanionTurnLineBase(turnEffect, turnEffect.amount + bondLevel + globalBonus);
  }
  if (turnEffect.kind === "chance") {
    const success = turnEffect.successEffects[0]
      ? formatCompanionTurnStartLine(turnEffect.successEffects[0], context)
      : null;
    const failure = turnEffect.failureEffects[0]
      ? formatCompanionTurnStartLine(turnEffect.failureEffects[0], context)
      : null;
    if (!success || !failure) return null;
    return `${success.replace(/ each turn$/, "")} or ${failure.replace(/ each turn$/, "")} each turn`;
  }
  return formatCompanionTurnLineBase(turnEffect);
}

export function expectedCompanionTurnLine(effect: BattleCardEffect): string {
  const line = companionTurnLine(effect);
  if (!line) throw new Error(`Unhandled companion turn-start effect: ${effect.kind}`);
  return line;
}

export function getCompanionDescriptionLines(companion: CompanionDefinition, bondLevel = 0, damageBonus = 0): string[] {
  const effects = getCompanionBondEffects(companion, bondLevel);
  const lines = effects.map((effect) => formatCompanionTurnStartLine(effect, { damageBonus }));
  const bonus = effects[1];
  if (bonus?.kind === "chance" && bonus.failureEffects.length === 0 && lines[0]) {
    const action = companion.id === "mana-moth" ? "grant" : "draw";
    return [`${lines[0]}, with a ${Math.round(bonus.probability * 100)}% chance to ${action} 1 more`];
  }
  const actions = lines.filter((line): line is string => line !== null).map((line) => line.replace(/ each turn$/, ""));
  if (actions.length === 0) return ["Acts at the start of each turn"];
  return [
    `${actions.map((action, index) => (index === 0 ? action : action.charAt(0).toLowerCase() + action.slice(1))).join(" and ")} each turn`,
  ];
}
