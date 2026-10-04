import { capitalizeWord } from "@/lib/utils";
import { getModifiedCompanionEffects, type CompanionDamageModifiers } from "../companions";
import type { CompanionDefinition, BattleCardEffect } from "../types";

function companionAction(effect: BattleCardEffect): string | null {
  switch (effect.kind) {
    case "damage": {
      const amount = effect.amount;
      const types = effect.damageTypePool?.length
        ? effect.damageTypePool.map(capitalizeWord)
        : [capitalizeWord(effect.damageType)];
      const last = types.pop();
      const damageLabel = types.length > 0 ? `${types.join(", ")} or ${last}` : last;
      return `Deals ${amount} ${damageLabel} damage`;
    }
    case "heal":
      return `Restores ${effect.amount} Health`;
    case "restore-mana":
      return `Gain ${effect.amount} Mana`;
    case "remove-harmful-status": {
      if (effect.removeAll) return "Cleanses all harmful status effects";
      const amount = effect.amount ?? 0;
      return `Cleanses ${amount} harmful status effect${amount === 1 ? "" : "s"}`;
    }
    case "gain-gold":
      return `Grants ${effect.amount} Gold`;
    case "player-status":
      return effect.status === "block" ? `Gains ${effect.amount} Block` : null;
    case "draw-cards": {
      return effect.amount === 1 ? "Draw a Card" : `Draw ${effect.amount} Cards`;
    }
    case "chance": {
      const success = effect.successEffects[0] ? companionAction(effect.successEffects[0]) : null;
      const failure = effect.failureEffects[0] ? companionAction(effect.failureEffects[0]) : null;
      return success && failure ? `${success} or ${failure}` : null;
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
    case "companion-action":
    case "random-draw":
    case "lose-health":
    case "remove-enemy-armor":
    case "multiply-enemy-status":
    case "cleanse-player-status-to-damage":
    case "random-damage":
    case "repeat-over-turns":
    case "next-hit-crit":
    case "next-hit-leech":
    case "play-next-card-twice":
    case "next-hit-poison":
    case "next-archery-free":
    case "dodge-next-attack":
      return null;
  }
}

export function getCompanionDescriptionLines(
  companion: CompanionDefinition,
  bondLevel = 0,
  damageBonus: number | CompanionDamageModifiers = 0,
): string[] {
  const modifiers =
    typeof damageBonus === "number" ? { damageBonus, bleedDamageBonus: 0, damageMultiplier: 1 } : damageBonus;
  const effects = getModifiedCompanionEffects(companion, bondLevel, modifiers);
  const lines = effects.map((effect) => {
    const line = companionAction(effect);
    return (companion.id === "golden-retriever" || companion.id === "fox") && effect.kind === "gain-gold"
      ? line?.replace(/^Grants /, "Steals ")
      : line;
  });
  const bonus = effects[1];
  const overflow = effects.some((effect) => effect.kind === "restore-mana" && effect.allowOverflow)
    ? ", allowing overflow"
    : "";
  if (bonus?.kind === "chance" && bonus.failureEffects.length === 0 && lines[0]) {
    const action = companion.id === "mana-moth" ? "grant" : "draw";
    return [
      `${lines[0]} each turn, with a ${Math.round(bonus.probability * 100)}% chance to ${action} 1 more${overflow}`,
    ];
  }
  const actions = lines.filter((line): line is string => line != null);
  if (actions.length === 0) return ["Acts at the start of each turn"];
  return [
    `${actions.map((action, index) => (index === 0 ? action : action.charAt(0).toLowerCase() + action.slice(1))).join(" and ")} each turn${overflow}`,
  ];
}
